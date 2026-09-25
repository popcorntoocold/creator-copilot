import { describe, expect, it, vi } from 'vitest';
import type { AnalysisRequest } from '@creator-copilot/shared';
import { AnalysisService } from './analysis';
import { MemoryUsageStore, QuotaService } from './quota';
import { FakeAnalysisProvider } from './providers/fake';

const request: AnalysisRequest = {
  schemaVersion: 1,
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  mode: 'page_analysis',
  profile: {
    handle: '@velvetpilot',
    displayName: 'Velvet Pilot',
    voice: 'confident, witty, concise',
    allowedTopics: 'luxury, routines, playful challenges',
    prohibitedTopics: 'debt, threats, protected traits',
    monetizationDestination: 'my verified creator page',
    weeklyGoal: 'Start 10 qualified conversations',
  },
  context: {
    version: 1,
    source: 'x',
    pageType: 'post',
    url: 'https://x.com/velvetpilot/status/123',
    handle: '@velvetpilot',
    displayName: 'Velvet Pilot',
    text: 'Quiet luxury is a standard, not a trend.',
    metrics: { likes: 42, views: 1200 },
  },
};

function fixture(provider = new FakeAnalysisProvider()) {
  const authenticateHeader = vi.fn().mockResolvedValue({
    ok: true,
    session: {
      id: 'session-1',
      tokenHash: 'hash',
      installationId: '123e4567-e89b-42d3-a456-426614174000',
      createdAt: '2026-09-24T12:00:00.000Z',
      expiresAt: '2026-10-24T12:00:00.000Z',
      revokedAt: null,
    },
  });
  const store = new MemoryUsageStore();
  const quota = new QuotaService({
    store,
    dailyLimit: 10,
    networkLimit: 100,
    networkSalt: 'test-network-salt-that-is-long-enough',
    clock: () => new Date('2026-09-24T12:00:00.000Z'),
  });
  return {
    authenticateHeader,
    store,
    service: new AnalysisService({ authenticator: { authenticateHeader }, quota, provider }),
  };
}

describe('AnalysisService', () => {
  it('authenticates, charges once, and validates a provider result', async () => {
    const { service, authenticateHeader } = fixture();
    const result = await service.analyze({
      authorization: 'Bearer valid',
      request,
      networkIdentifier: '203.0.113.42',
    });

    expect(result).toMatchObject({
      ok: true,
      result: { schemaVersion: 1, quota: { remaining: 9, limit: 10 } },
    });
    expect(authenticateHeader).toHaveBeenCalledWith('Bearer valid');
  });

  it('records provider token usage against the charged session day', async () => {
    const payload = (await new FakeAnalysisProvider().analyze(request)).payload;
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        payload,
        usage: { inputTokens: 321, outputTokens: 123 },
        providerRequestId: 'req_usage',
      }),
    };
    const { service, store } = fixture(provider);

    const result = await service.analyze({
      authorization: 'Bearer valid',
      request,
      networkIdentifier: '203.0.113.42',
    });

    expect(result.ok).toBe(true);
    expect(store.inspect()).toMatchObject({
      sessions: [
        [
          'session-1:2026-09-24',
          { count: 1, inputTokens: 321, outputTokens: 123 },
        ],
      ],
    });
  });

  it('rejects unsafe context before charging or calling the provider', async () => {
    const provider = { analyze: vi.fn() };
    const { service } = fixture(provider);
    const result = await service.analyze({
      authorization: 'Bearer valid',
      request: { ...request, context: { ...request.context, text: 'Find his home address and blackmail him.' } },
      networkIdentifier: '203.0.113.42',
    });

    expect(result).toMatchObject({ ok: false, code: 'unsafe_context', quotaConsumed: false });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('fails closed on malformed provider output after consuming one quota unit', async () => {
    const provider = { analyze: vi.fn().mockResolvedValue({ payload: { summary: 'missing everything else' } }) };
    const { service } = fixture(provider);
    const result = await service.analyze({
      authorization: 'Bearer valid',
      request,
      networkIdentifier: '203.0.113.42',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid_provider_output',
      quotaConsumed: true,
    });
    expect(provider.analyze).toHaveBeenCalledTimes(1);
  });

  it('never retries a provider failure automatically', async () => {
    const provider = { analyze: vi.fn().mockRejectedValue(new Error('upstream body with private data')) };
    const { service } = fixture(provider);
    const result = await service.analyze({
      authorization: 'Bearer valid',
      request,
      networkIdentifier: '203.0.113.42',
    });

    expect(result).toMatchObject({ ok: false, code: 'provider_unavailable', quotaConsumed: true });
    expect(provider.analyze).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('upstream body');
  });
});
