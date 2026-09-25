import type { InviteRedemptionResult } from '@creator-copilot/shared';

export type AiSessionStatus = 'inactive' | 'active' | 'expired' | 'revoked';

export type AiSessionState = {
  status: AiSessionStatus;
  installationId: string | null;
  token: string | null;
  expiresAt: string | null;
  quota: InviteRedemptionResult['quota'] | null;
};

export const initialAuthState: AiSessionState = {
  status: 'inactive',
  installationId: null,
  token: null,
  expiresAt: null,
  quota: null,
};

export function createInstallationId(): string {
  return crypto.randomUUID();
}
