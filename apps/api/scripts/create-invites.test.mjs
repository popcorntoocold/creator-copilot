import { describe, expect, it } from 'vitest';
import { generateInviteBatch } from './create-invites.mjs';

describe('generateInviteBatch', () => {
  it('returns plaintext once while producing hash-only SQL', () => {
    let seed = 1;
    const batch = generateInviteBatch(2, {
      now: new Date('2026-09-24T12:00:00.000Z'),
      randomSource: (length) => Buffer.from(Array.from({ length }, () => seed++ % 255)),
    });

    expect(batch.codes).toHaveLength(2);
    expect(batch.codes[0].code).toMatch(/^cc_[A-Za-z0-9_-]{32}$/);
    expect(batch.sql).toContain('INSERT INTO invites');
    expect(batch.sql).toContain('2026-09-24T12:00:00.000Z');
    expect(batch.sql).not.toContain(batch.codes[0].code);
    expect(batch.sql).not.toContain(batch.codes[1].code);
  });

  it('bounds batch size', () => {
    expect(() => generateInviteBatch(0)).toThrow();
    expect(() => generateInviteBatch(51)).toThrow();
  });
});
