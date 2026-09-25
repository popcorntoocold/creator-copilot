import { describe, expect, it } from 'vitest';
import { MemoryUsageStore, QuotaService, hashNetworkIdentifier, type Clock } from './quota';

function fixture(options: { dailyLimit?: number; networkLimit?: number } = {}) {
  let now = new Date('2026-09-24T12:00:00.000Z');
  const clock: Clock = () => now;
  const store = new MemoryUsageStore();
  const service = new QuotaService({
    store,
    dailyLimit: options.dailyLimit ?? 2,
    networkLimit: options.networkLimit ?? 20,
    networkSalt: 'test-network-salt-that-is-long-enough',
    clock,
  });
  return { store, service, setNow: (value: string) => (now = new Date(value)) };
}

describe('QuotaService', () => {
  it('allows only the configured number of concurrent session charges', async () => {
    const { service } = fixture({ dailyLimit: 2 });
    const results = await Promise.all([
      service.charge('session-1', '203.0.113.42'),
      service.charge('session-1', '203.0.113.42'),
      service.charge('session-1', '203.0.113.42'),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      ok: false,
      reason: 'session_limit',
    });
  });

  it('resets at UTC midnight', async () => {
    const { service, setNow } = fixture({ dailyLimit: 1 });
    expect(await service.charge('session-1', '203.0.113.42')).toMatchObject({ ok: true });
    expect(await service.charge('session-1', '203.0.113.42')).toEqual({
      ok: false,
      reason: 'session_limit',
      resetsAt: '2026-09-25T00:00:00.000Z',
    });
    setNow('2026-09-25T00:00:01.000Z');
    expect(await service.charge('session-1', '203.0.113.42')).toMatchObject({
      ok: true,
      quota: { remaining: 0, limit: 1, resetsAt: '2026-09-26T00:00:00.000Z' },
    });
  });

  it('applies a coarse network ceiling without storing the raw address', async () => {
    const { service, store } = fixture({ dailyLimit: 10, networkLimit: 2 });
    expect(await service.charge('session-1', '203.0.113.42')).toMatchObject({ ok: true });
    expect(await service.charge('session-2', '203.0.113.42')).toMatchObject({ ok: true });
    expect(await service.charge('session-3', '203.0.113.42')).toMatchObject({
      ok: false,
      reason: 'network_limit',
    });
    expect(JSON.stringify(store.inspect())).not.toContain('203.0.113.42');
  });

  it('records token usage on the same charged UTC day', async () => {
    const { service, store } = fixture();
    const charge = await service.charge('session-1', '203.0.113.42');
    expect(charge).toMatchObject({ ok: true, day: '2026-09-24' });
    if (!charge.ok) throw new Error('Expected a quota charge.');

    await service.recordTokens('session-1', charge.day, { inputTokens: 50, outputTokens: 20 });

    expect(store.inspect()).toMatchObject({
      sessions: [['session-1:2026-09-24', { count: 1, inputTokens: 50, outputTokens: 20 }]],
    });
  });
});

describe('hashNetworkIdentifier', () => {
  it('changes by day and never returns the input', async () => {
    const first = await hashNetworkIdentifier('203.0.113.42', 'salt', '2026-09-24');
    const second = await hashNetworkIdentifier('203.0.113.42', 'salt', '2026-09-25');
    expect(first).not.toBe('203.0.113.42');
    expect(first).not.toBe(second);
  });
});
