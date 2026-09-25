import { describe, expect, it } from 'vitest';
import {
  AuthService,
  MemoryAuthStore,
  hashSecret,
  type Clock,
  type RandomBytes,
} from './auth';

const inviteCode = 'creator-beta-1234567890';
const installationId = '123e4567-e89b-42d3-a456-426614174000';
const signingSecret = 'test-signing-secret-that-is-at-least-32-bytes';

function deterministicBytes(): RandomBytes {
  let seed = 0;
  return (length) => Uint8Array.from({ length }, (_, index) => (seed++ + index + 17) % 256);
}

async function fixture() {
  let now = new Date('2026-09-24T12:00:00.000Z');
  const clock: Clock = () => now;
  const store = new MemoryAuthStore();
  await store.addInvite(await hashSecret(inviteCode), 'pilot-1');
  const service = new AuthService({
    store,
    signingSecret,
    dailyLimit: 10,
    clock,
    randomBytes: deterministicBytes(),
  });
  return {
    store,
    service,
    setNow(value: string) {
      now = new Date(value);
    },
  };
}

describe('AuthService', () => {
  it('redeems a one-time invite without storing plaintext secrets', async () => {
    const { service, store } = await fixture();
    const result = await service.redeemInvite({ inviteCode, installationId });

    expect(result?.token).toMatch(/^ccs1\./);
    expect(result?.quota).toMatchObject({ limit: 10, remaining: 10 });
    expect(await service.redeemInvite({ inviteCode, installationId })).toBeNull();

    const stored = JSON.stringify(store.inspect());
    expect(stored).not.toContain(inviteCode);
    expect(stored).not.toContain(result?.token ?? 'missing-token');
    expect(stored).toContain(installationId);
  });

  it('authenticates an untampered token and rejects a modified token', async () => {
    const { service } = await fixture();
    const redeemed = await service.redeemInvite({ inviteCode, installationId });
    expect(redeemed).not.toBeNull();

    const authenticated = await service.authenticateHeader(`Bearer ${redeemed!.token}`);
    const tampered = await service.authenticateHeader(`Bearer ${redeemed!.token.slice(0, -1)}x`);

    expect(authenticated).toMatchObject({ ok: true, session: { installationId } });
    expect(tampered).toEqual({ ok: false, reason: 'invalid' });
  });

  it('distinguishes expiry and revocation without accepting the token', async () => {
    const expiring = await fixture();
    const first = await expiring.service.redeemInvite({ inviteCode, installationId });
    expiring.setNow('2026-10-25T12:00:00.000Z');
    expect(await expiring.service.authenticateHeader(`Bearer ${first!.token}`)).toEqual({
      ok: false,
      reason: 'expired',
    });

    const revoking = await fixture();
    const second = await revoking.service.redeemInvite({ inviteCode, installationId });
    expect(await revoking.service.revokeSession(`Bearer ${second!.token}`)).toMatchObject({ ok: true });
    expect(await revoking.service.authenticateHeader(`Bearer ${second!.token}`)).toEqual({
      ok: false,
      reason: 'revoked',
    });
  });

  it('rejects missing and malformed authorization headers', async () => {
    const { service } = await fixture();

    expect(await service.authenticateHeader(null)).toEqual({ ok: false, reason: 'invalid' });
    expect(await service.authenticateHeader('Basic abc')).toEqual({ ok: false, reason: 'invalid' });
    expect(await service.authenticateHeader('Bearer not-a-token')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
