import { describe, expect, it, vi } from 'vitest';
import { API_SCHEMA_VERSION } from '@creator-copilot/shared';
import { MAX_JSON_BODY_BYTES, createRouter, readJsonBody } from './router';

const allowedOrigin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.creatorcopilot.test${path}`, init);
}

describe('createRouter', () => {
  it('returns a minimal health response', async () => {
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]) });
    const response = await router.fetch(request('/v1/health'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, schemaVersion: API_SCHEMA_VERSION });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects disallowed origins before routing', async () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]), logger });
    const response = await router.fetch(
      request('/v1/health', { headers: { origin: 'https://attacker.example' } }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'origin_not_allowed', retryable: false },
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('handles an allowed preflight without reflecting arbitrary headers', async () => {
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]) });
    const response = await router.fetch(
      request('/v1/analyses', {
        method: 'OPTIONS',
        headers: {
          origin: allowedOrigin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type, x-evil',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
  });

  it('returns stable errors for unknown routes and invalid methods', async () => {
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]) });
    const missing = await router.fetch(request('/v1/nope'));
    const wrongMethod = await router.fetch(request('/v1/health', { method: 'POST' }));

    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('GET');
  });

  it('redeems an invite and revokes the active session through the auth boundary', async () => {
    const token = 'ccs1.session.secret.signature';
    const auth = {
      redeemInvite: vi.fn().mockResolvedValue({
        schemaVersion: API_SCHEMA_VERSION,
        token,
        expiresAt: '2026-10-24T12:00:00.000Z',
        quota: { remaining: 10, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
      }),
      revokeSession: vi.fn().mockResolvedValue({ ok: true, session: { id: 'session-1' } }),
    };
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]), auth });
    const redeem = await router.fetch(
      request('/v1/invites/redeem', {
        method: 'POST',
        headers: { origin: allowedOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({
          inviteCode: 'creator-beta-1234567890',
          installationId: '123e4567-e89b-42d3-a456-426614174000',
        }),
      }),
    );
    const revoke = await router.fetch(
      request('/v1/session', {
        method: 'DELETE',
        headers: { origin: allowedOrigin, authorization: `Bearer ${token}` },
      }),
    );

    expect(redeem.status).toBe(200);
    expect(await redeem.json()).toMatchObject({ token, quota: { remaining: 10 } });
    expect(auth.redeemInvite).toHaveBeenCalledTimes(1);
    expect(revoke.status).toBe(204);
    expect(auth.revokeSession).toHaveBeenCalledWith(`Bearer ${token}`);
  });

  it('does not reveal whether an invite code ever existed', async () => {
    const auth = {
      redeemInvite: vi.fn().mockResolvedValue(null),
      revokeSession: vi.fn(),
    };
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]), auth });
    const response = await router.fetch(
      request('/v1/invites/redeem', {
        method: 'POST',
        headers: { origin: allowedOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({
          inviteCode: 'creator-beta-0000000000',
          installationId: '123e4567-e89b-42d3-a456-426614174000',
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'invite_invalid' } });
  });

  it('validates an analysis request before invoking the analysis service', async () => {
    const analysis = { analyze: vi.fn() };
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]), analysis });
    const response = await router.fetch(
      request('/v1/analyses', {
        method: 'POST',
        headers: { origin: allowedOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({ schemaVersion: 1, requestId: 'not-a-uuid' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'invalid_request', quotaConsumed: false },
    });
    expect(analysis.analyze).not.toHaveBeenCalled();
  });

  it('returns a validated analysis outcome from the service', async () => {
    const result = {
      schemaVersion: 1,
      summary: 'A concise premise.',
      evidence: ['The supplied post text is short.'],
      recommendations: [],
      experiment: {},
      notices: [],
      quota: { remaining: 9, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
    };
    const analysis = { analyze: vi.fn().mockResolvedValue({ ok: true, result }) };
    const router = createRouter({ allowedOrigins: new Set([allowedOrigin]), analysis });
    const body = {
      schemaVersion: 1,
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      mode: 'page_analysis',
      profile: {
        handle: '@velvetpilot',
        displayName: 'Velvet Pilot',
        voice: 'confident, witty, concise',
        allowedTopics: 'luxury',
        prohibitedTopics: 'debt',
        monetizationDestination: 'verified creator page',
        weeklyGoal: 'Five useful conversations',
      },
      context: {
        version: 1,
        source: 'x',
        pageType: 'post',
        url: 'https://x.com/velvetpilot/status/123',
        text: 'Quiet luxury is the standard.',
        metrics: { views: 1200 },
      },
    };
    const response = await router.fetch(
      request('/v1/analyses', {
        method: 'POST',
        headers: {
          origin: allowedOrigin,
          'content-type': 'application/json',
          authorization: 'Bearer valid',
          'cf-connecting-ip': '203.0.113.42',
        },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(analysis.analyze).toHaveBeenCalledWith({
      authorization: 'Bearer valid',
      request: body,
      networkIdentifier: '203.0.113.42',
    });
  });
});

describe('readJsonBody', () => {
  it('requires application/json', async () => {
    const result = await readJsonBody(
      request('/v1/analyses', { method: 'POST', body: 'hello', headers: { 'content-type': 'text/plain' } }),
    );

    expect(result).toEqual({ ok: false, status: 415, message: 'Content-Type must be application/json.' });
  });

  it('rejects a declared or actual body larger than 24 KiB', async () => {
    const declared = await readJsonBody(
      request('/v1/analyses', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json', 'content-length': String(MAX_JSON_BODY_BYTES + 1) },
      }),
    );
    const actual = await readJsonBody(
      request('/v1/analyses', {
        method: 'POST',
        body: JSON.stringify({ value: 'x'.repeat(MAX_JSON_BODY_BYTES) }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(declared).toMatchObject({ ok: false, status: 413 });
    expect(actual).toMatchObject({ ok: false, status: 413 });
  });

  it('parses a bounded JSON object', async () => {
    const result = await readJsonBody(
      request('/v1/analyses', {
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    expect(result).toEqual({ ok: true, value: { hello: 'world' } });
  });
});
