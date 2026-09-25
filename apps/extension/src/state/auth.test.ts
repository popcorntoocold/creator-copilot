import { describe, expect, it } from 'vitest';
import { createInstallationId, initialAuthState } from './auth';

describe('extension auth state', () => {
  it('starts inactive without retained credentials', () => {
    expect(initialAuthState).toEqual({
      status: 'inactive',
      installationId: null,
      token: null,
      expiresAt: null,
      quota: null,
    });
  });

  it('creates a UUID installation identifier', () => {
    expect(createInstallationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
