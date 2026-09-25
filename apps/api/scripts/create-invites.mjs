import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function generateInviteBatch(count, options = {}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 50) {
    throw new Error('Invite count must be an integer from 1 through 50.');
  }
  const source = options.randomSource ?? randomBytes;
  const createdAt = (options.now ?? new Date()).toISOString();
  const prefix = options.labelPrefix ?? 'pilot';
  const invites = Array.from({ length: count }, (_, index) => {
    const code = `cc_${source(24).toString('base64url')}`;
    return {
      code,
      hash: createHash('sha256').update(code).digest('hex'),
      label: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    };
  });
  const values = invites
    .map(({ hash, label }) => `(${sqlString(hash)}, ${sqlString(label)}, ${sqlString(createdAt)}, NULL)`)
    .join(',\n');
  return {
    codes: invites.map(({ code, label }) => ({ label, code })),
    sql: `INSERT INTO invites (invite_hash, label, created_at, redeemed_at) VALUES\n${values};\n`,
  };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const count = Number.parseInt(process.argv[2] ?? '1', 10);
  const outputPath = resolve(process.argv[3] ?? 'apps/api/.generated/invites.sql');
  const batch = generateInviteBatch(count);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, batch.sql, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ outputPath, invites: batch.codes }, null, 2)}\n`);
}
