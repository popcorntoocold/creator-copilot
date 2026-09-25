import {
  API_SCHEMA_VERSION,
  analysisRequestSchema,
  inviteRedemptionRequestSchema,
} from '@creator-copilot/shared';
import type { AnalysisService } from './analysis';
import type { AuthGateway } from './auth';
import { errorResponse } from './errors';
import { publicPageResponse } from './publicPages';

export const MAX_JSON_BODY_BYTES = 24 * 1024;

export type Logger = Pick<Console, 'error' | 'info' | 'warn'>;

export type RouterDependencies = {
  allowedOrigins: ReadonlySet<string>;
  logger?: Logger;
  auth?: AuthGateway;
  analysis?: Pick<AnalysisService, 'analyze'>;
};

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; message: string };

function securityHeaders(origin?: string): HeadersInit {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  };
}

function json(value: unknown, status = 200, origin?: string, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...securityHeaders(origin), ...extraHeaders },
  });
}

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, message: 'Content-Type must be application/json.' };
  }

  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Request body is too large.' };
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Request body is too large.' };
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400, message: 'Request body must contain valid JSON.' };
  }
}

function authErrorReason(reason: 'invalid' | 'expired' | 'revoked') {
  if (reason === 'expired') return { code: 'session_expired' as const, message: 'This session has expired.' };
  if (reason === 'revoked') return { code: 'session_revoked' as const, message: 'This session was revoked.' };
  return { code: 'authentication_required' as const, message: 'A valid session is required.' };
}

export function createRouter({ allowedOrigins, logger = console, auth, analysis }: RouterDependencies) {
  return {
    async fetch(request: Request): Promise<Response> {
      const originHeader = request.headers.get('origin') ?? undefined;
      const allowedOrigin = originHeader && allowedOrigins.has(originHeader) ? originHeader : undefined;

      if (originHeader && !allowedOrigin) {
        logger.warn('Request rejected by origin policy.');
        return errorResponse(403, {
          code: 'origin_not_allowed',
          message: 'This client origin is not allowed.',
        });
      }

      if (request.method === 'OPTIONS') {
        if (!allowedOrigin) {
          return errorResponse(403, {
            code: 'origin_not_allowed',
            message: 'An allowed origin is required for preflight.',
          });
        }
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': allowedOrigin,
            'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-max-age': '600',
            vary: 'Origin',
          },
        });
      }

      const url = new URL(request.url);
      const publicPage = publicPageResponse(url.pathname, request.method);
      if (publicPage) return publicPage;

      if (url.pathname === '/v1/health') {
        if (request.method !== 'GET') {
          return errorResponse(
            405,
            { code: 'method_not_allowed', message: 'Method not allowed.' },
            { ...securityHeaders(allowedOrigin), allow: 'GET' },
          );
        }
        return json({ ok: true, schemaVersion: API_SCHEMA_VERSION }, 200, allowedOrigin);
      }

      if (url.pathname === '/v1/invites/redeem') {
        if (request.method !== 'POST') {
          return errorResponse(
            405,
            { code: 'method_not_allowed', message: 'Method not allowed.' },
            { ...securityHeaders(allowedOrigin), allow: 'POST' },
          );
        }
        if (!auth) {
          return errorResponse(
            503,
            { code: 'internal_error', message: 'Activation is temporarily unavailable.', retryable: true },
            securityHeaders(allowedOrigin),
          );
        }
        const body = await readJsonBody(request);
        if (!body.ok) {
          return errorResponse(
            body.status,
            { code: 'invalid_request', message: body.message },
            securityHeaders(allowedOrigin),
          );
        }
        const parsed = inviteRedemptionRequestSchema.safeParse(body.value);
        if (!parsed.success) {
          return errorResponse(
            400,
            { code: 'invalid_request', message: 'The activation request is invalid.' },
            securityHeaders(allowedOrigin),
          );
        }
        const result = await auth.redeemInvite(parsed.data);
        if (!result) {
          return errorResponse(
            401,
            { code: 'invite_invalid', message: 'This invite cannot be redeemed.' },
            securityHeaders(allowedOrigin),
          );
        }
        return json(result, 200, allowedOrigin);
      }

      if (url.pathname === '/v1/session') {
        if (request.method !== 'DELETE') {
          return errorResponse(
            405,
            { code: 'method_not_allowed', message: 'Method not allowed.' },
            { ...securityHeaders(allowedOrigin), allow: 'DELETE' },
          );
        }
        if (!auth) {
          return errorResponse(
            503,
            { code: 'internal_error', message: 'Session management is temporarily unavailable.', retryable: true },
            securityHeaders(allowedOrigin),
          );
        }
        const result = await auth.revokeSession(request.headers.get('authorization'));
        if (!result.ok) {
          const details = authErrorReason(result.reason);
          return errorResponse(401, { ...details, retryable: false }, securityHeaders(allowedOrigin));
        }
        return new Response(null, { status: 204, headers: securityHeaders(allowedOrigin) });
      }

      if (url.pathname === '/v1/analyses') {
        if (request.method !== 'POST') {
          return errorResponse(
            405,
            { code: 'method_not_allowed', message: 'Method not allowed.' },
            { ...securityHeaders(allowedOrigin), allow: 'POST' },
          );
        }
        if (!analysis) {
          return errorResponse(
            503,
            { code: 'internal_error', message: 'Analysis is temporarily unavailable.', retryable: true },
            securityHeaders(allowedOrigin),
          );
        }
        const body = await readJsonBody(request);
        if (!body.ok) {
          return errorResponse(
            body.status,
            { code: 'invalid_request', message: body.message, quotaConsumed: false },
            securityHeaders(allowedOrigin),
          );
        }
        const parsed = analysisRequestSchema.safeParse(body.value);
        if (!parsed.success) {
          return errorResponse(
            400,
            { code: 'invalid_request', message: 'The analysis request is invalid.', quotaConsumed: false },
            securityHeaders(allowedOrigin),
          );
        }
        const outcome = await analysis.analyze({
          authorization: request.headers.get('authorization'),
          request: parsed.data,
          networkIdentifier: request.headers.get('cf-connecting-ip') ?? '',
        });
        if (!outcome.ok) {
          return errorResponse(
            outcome.status,
            {
              code: outcome.code,
              message: outcome.message,
              retryable: outcome.retryable,
              requestId: parsed.data.requestId,
              quotaConsumed: outcome.quotaConsumed,
            },
            securityHeaders(allowedOrigin),
          );
        }
        return json(outcome.result, 200, allowedOrigin);
      }

      return errorResponse(
        404,
        { code: 'not_found', message: 'Route not found.' },
        securityHeaders(allowedOrigin),
      );
    },
  };
}
