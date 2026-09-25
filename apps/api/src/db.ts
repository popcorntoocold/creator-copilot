export type SessionRecord = {
  id: string;
  tokenHash: string;
  installationId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type RedeemInviteRecord = SessionRecord & {
  inviteHash: string;
};

export interface AuthStore {
  redeemInvite(record: RedeemInviteRecord): Promise<boolean>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(id: string, revokedAt: string): Promise<void>;
}

type SessionRow = {
  id: string;
  token_hash: string;
  installation_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    installationId: row.installation_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class D1AuthStore implements AuthStore {
  constructor(private readonly database: D1Database) {}

  async redeemInvite(record: RedeemInviteRecord): Promise<boolean> {
    try {
      const [insert] = await this.database.batch([
        this.database
          .prepare(
            `INSERT INTO sessions
              (id, invite_hash, token_hash, installation_id, created_at, expires_at, revoked_at)
             SELECT ?, invite_hash, ?, ?, ?, ?, NULL
             FROM invites
             WHERE invite_hash = ? AND redeemed_at IS NULL`,
          )
          .bind(
            record.id,
            record.tokenHash,
            record.installationId,
            record.createdAt,
            record.expiresAt,
            record.inviteHash,
          ),
        this.database
          .prepare(
            `UPDATE invites
             SET redeemed_at = ?
             WHERE invite_hash = ?
               AND redeemed_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM sessions WHERE id = ? AND invite_hash = ?
               )`,
          )
          .bind(record.createdAt, record.inviteHash, record.id, record.inviteHash),
      ]);
      return (insert?.meta.changes ?? 0) === 1;
    } catch {
      return false;
    }
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, token_hash, installation_id, created_at, expires_at, revoked_at
         FROM sessions WHERE token_hash = ? LIMIT 1`,
      )
      .bind(tokenHash)
      .first<SessionRow>();
    return row ? toSession(row) : null;
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    await this.database
      .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(revokedAt, id)
      .run();
  }
}
