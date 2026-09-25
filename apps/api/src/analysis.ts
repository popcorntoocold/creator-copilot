import {
  analysisPayloadSchema,
  classifySafety,
  type AnalysisRequest,
  type AnalysisResult,
  type ApiErrorCode,
} from '@creator-copilot/shared';
import type { AuthenticationResult } from './auth';
import type { QuotaService } from './quota';
import type { AnalysisProvider } from './providers/types';

export type Authenticator = {
  authenticateHeader(authorization: string | null): Promise<AuthenticationResult>;
};

export type AnalysisOutcome =
  | { ok: true; result: AnalysisResult }
  | {
      ok: false;
      status: number;
      code: ApiErrorCode;
      message: string;
      retryable: boolean;
      quotaConsumed: boolean;
    };

export class AnalysisService {
  constructor(
    private readonly dependencies: {
      authenticator: Authenticator;
      quota: QuotaService;
      provider: AnalysisProvider;
    },
  ) {}

  async analyze(input: {
    authorization: string | null;
    request: AnalysisRequest;
    networkIdentifier: string;
  }): Promise<AnalysisOutcome> {
    const authentication = await this.dependencies.authenticator.authenticateHeader(input.authorization);
    if (!authentication.ok) {
      const code =
        authentication.reason === 'expired'
          ? 'session_expired'
          : authentication.reason === 'revoked'
            ? 'session_revoked'
            : 'authentication_required';
      return {
        ok: false,
        status: 401,
        code,
        message: 'A valid creator session is required.',
        retryable: false,
        quotaConsumed: false,
      };
    }

    if (!classifySafety(input.request.context.text).safe) {
      return {
        ok: false,
        status: 400,
        code: 'unsafe_context',
        message: 'This context cannot be analyzed.',
        retryable: false,
        quotaConsumed: false,
      };
    }

    const charge = await this.dependencies.quota.charge(
      authentication.session.id,
      input.networkIdentifier,
    );
    if (!charge.ok) {
      return {
        ok: false,
        status: 429,
        code: 'quota_exhausted',
        message: 'The analysis limit has been reached. Try again after the displayed reset time.',
        retryable: false,
        quotaConsumed: charge.quotaConsumed ?? false,
      };
    }

    let providerResult;
    try {
      providerResult = await this.dependencies.provider.analyze(input.request, {
        safetyIdentifier: `cc_${authentication.session.installationId}`,
        clientRequestId: input.request.requestId,
      });
      if (providerResult.usage) {
        await this.dependencies.quota.recordTokens(
          authentication.session.id,
          charge.day,
          providerResult.usage,
        );
      }
    } catch {
      return {
        ok: false,
        status: 503,
        code: 'provider_unavailable',
        message: 'AI analysis is temporarily unavailable. You can retry manually.',
        retryable: true,
        quotaConsumed: true,
      };
    }

    const parsed = analysisPayloadSchema.safeParse(providerResult.payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 502,
        code: 'invalid_provider_output',
        message: 'AI analysis returned an invalid result. You can retry manually.',
        retryable: true,
        quotaConsumed: true,
      };
    }

    return { ok: true, result: { ...parsed.data, quota: charge.quota } };
  }
}
