import {
  API_SCHEMA_VERSION,
  type InviteRedemptionRequest,
  type InviteRedemptionResult,
} from '@creator-copilot/shared';
import type { AuthStore, RedeemInviteRecord, SessionRecord } from './db';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_PREFIX = 'ccs1';

export type Clock = () => Date;
export type RandomBytes = (length: number) => Uint8Array;
export type AuthenticationResult =
  | { ok: true; session: SessionRecord }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' };

export type AuthGateway = {
  redeemInvite(input: InviteRedemptionRequest): Promise<InviteRedemptionResult | null>;
  revokeSession(authorization: string | null): Promise<AuthenticationResult>;
};

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function hashSecret(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))),
  );
}

async function createToken(
  signingSecret: string,
  randomBytes: RandomBytes,
): Promise<{ id: string; token: string }> {
  const id = bytesToBase64Url(randomBytes(18));
  const secret = bytesToBase64Url(randomBytes(32));
  const unsigned = `${TOKEN_PREFIX}.${id}.${secret}`;
  return { id, token: `${unsigned}.${await sign(unsigned, signingSecret)}` };
}

async function verifyToken(token: string, signingSecret: string): Promise<{ id: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2] || !parts[3]) {
    return null;
  }
  const unsigned = parts.slice(0, 3).join('.');
  const expected = await sign(unsigned, signingSecret);
  return constantTimeEqual(expected, parts[3]) ? { id: parts[1] } : null;
}

function nextUtcMidnight(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export type AuthServiceOptions = {
  store: AuthStore;
  signingSecret: string;
  dailyLimit: number;
  clock?: Clock;
  randomBytes?: RandomBytes;
};

export class AuthService implements AuthGateway {
  private readonly store: AuthStore;
  private readonly signingSecret: string;
  private readonly dailyLimit: number;
  private readonly clock: Clock;
  private readonly randomBytes: RandomBytes;

  constructor({
    store,
    signingSecret,
    dailyLimit,
    clock = () => new Date(),
    randomBytes = defaultRandomBytes,
  }: AuthServiceOptions) {
    if (encoder.encode(signingSecret).byteLength < 32) {
      throw new Error('SESSION_SIGNING_SECRET must be at least 32 bytes.');
    }
    this.store = store;
    this.signingSecret = signingSecret;
    this.dailyLimit = dailyLimit;
    this.clock = clock;
    this.randomBytes = randomBytes;
  }

  async redeemInvite(input: InviteRedemptionRequest): Promise<InviteRedemptionResult | null> {
    const now = this.clock();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString();
    const inviteHash = await hashSecret(input.inviteCode);
    const { id, token } = await createToken(this.signingSecret, this.randomBytes);
    const tokenHash = await hashSecret(token);
    const redeemed = await this.store.redeemInvite({
      id,
      inviteHash,
      tokenHash,
      installationId: input.installationId,
      createdAt,
      expiresAt,
      revokedAt: null,
    });

    if (!redeemed) return null;
    return {
      schemaVersion: API_SCHEMA_VERSION,
      token,
      expiresAt,
      quota: {
        remaining: this.dailyLimit,
        limit: this.dailyLimit,
        resetsAt: nextUtcMidnight(now),
      },
    };
  }

  async authenticateHeader(authorization: string | null): Promise<AuthenticationResult> {
    const match = /^Bearer ([^\s]+)$/u.exec(authorization ?? '');
    if (!match?.[1]) return { ok: false, reason: 'invalid' };
    const token = match[1];
    const verified = await verifyToken(token, this.signingSecret);
    if (!verified) return { ok: false, reason: 'invalid' };

    const session = await this.store.findSessionByTokenHash(await hashSecret(token));
    if (!session || session.id !== verified.id) return { ok: false, reason: 'invalid' };
    if (session.revokedAt) return { ok: false, reason: 'revoked' };
    if (Date.parse(session.expiresAt) <= this.clock().getTime()) return { ok: false, reason: 'expired' };
    return { ok: true, session };
  }

  async revokeSession(authorization: string | null): Promise<AuthenticationResult> {
    const authentication = await this.authenticateHeader(authorization);
    if (!authentication.ok) return authentication;
    await this.store.revokeSession(authentication.session.id, this.clock().toISOString());
    return authentication;
  }
}

export class MemoryAuthStore implements AuthStore {
  private readonly invites = new Map<string, { label: string; redeemedAt: string | null }>();
  private readonly sessions = new Map<string, SessionRecord & { inviteHash: string }>();

  async addInvite(inviteHash: string, label: string): Promise<void> {
    this.invites.set(inviteHash, { label, redeemedAt: null });
  }

  async redeemInvite(record: RedeemInviteRecord): Promise<boolean> {
    const invite = this.invites.get(record.inviteHash);
    if (!invite || invite.redeemedAt || [...this.sessions.values()].some((item) => item.inviteHash === record.inviteHash)) {
      return false;
    }
    invite.redeemedAt = record.createdAt;
    this.sessions.set(record.tokenHash, { ...record });
    return true;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    return session ? structuredClone(session) : null;
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    const session = [...this.sessions.values()].find((item) => item.id === id);
    if (session) session.revokedAt = revokedAt;
  }

  inspect(): unknown {
    return {
      invites: [...this.invites.entries()],
      sessions: [...this.sessions.entries()],
    };
  }
}
