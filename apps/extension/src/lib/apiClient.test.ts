import { describe, expect, it, vi } from 'vitest';
import type { CreatorProfile, PageContext } from '@creator-copilot/shared';
import { ApiClientError, CreatorCopilotApiClient, validateApiBaseUrl } from './apiClient';

const profile: CreatorProfile = {
  handle: '@velvetpilot',
  displayName: 'Velvet Pilot',
  voice: 'confident and concise',
  allowedTopics: 'luxury',
  prohibitedTopics: 'debt and threats',
  contentFrequency: 'Daily',
  preferredFormats: ['Post'],
  monetizationDestination: 'verified creator page',
  weeklyGoal: 'Five useful conversations',
  consentAccepted: true,
};

const context: PageContext = {
  version: 1,
  source: 'x',
  pageType: 'post',
  url: 'https://x.com/velvetpilot/status/123',
  text: 'Quiet luxury is the standard.',
  metrics: { views: 1200 },
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CreatorCopilotApiClient', () => {
  it('redeems an invite once without retaining it in the client', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        schemaVersion: 1,
        token: 'ccs1.session.secret.signature',
        expiresAt: '2026-10-24T12:00:00.000Z',
        quota: { remaining: 10, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
      }),
    );
    const client = new CreatorCopilotApiClient({ baseUrl: 'https://api.example.com', fetch });
    const result = await client.redeemInvite(
      'creator-beta-1234567890',
      '123e4567-e89b-42d3-a456-426614174000',
    );

    expect(result.token).toMatch(/^ccs1/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/invites/redeem');
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({
      inviteCode: 'creator-beta-1234567890',
      installationId: '123e4567-e89b-42d3-a456-426614174000',
    });
  });

  it('refuses analysis without an active token and never calls fetch', async () => {
    const fetch = vi.fn();
    const client = new CreatorCopilotApiClient({ baseUrl: 'https://api.example.com', fetch });

    await expect(client.analyze({ token: null, profile, context })).rejects.toMatchObject({
      code: 'authentication_required',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends only the bounded analysis profile and validates the response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        schemaVersion: 1,
        summary: 'A concise premise.',
        evidence: ['The visible text is short.'],
        recommendations: [
          { id: '1', kind: 'hook', title: 'Hook', rationale: 'Why', draft: 'Draft 1', copyable: true, requiresReview: true, status: 'ready' },
          { id: '2', kind: 'reply', title: 'Reply', rationale: 'Why', draft: 'Draft 2', copyable: true, requiresReview: true, status: 'ready' },
          { id: '3', kind: 'follow_up', title: 'Follow-up', rationale: 'Why', draft: 'Draft 3', copyable: true, requiresReview: true, status: 'ready' },
        ],
        experiment: { id: 'e1', title: 'Test', hypothesis: 'Hypothesis', instructions: ['Do it'], metric: 'Replies' },
        notices: ['This is a hypothesis.'],
        quota: { remaining: 9, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
      }),
    );
    const client = new CreatorCopilotApiClient({ baseUrl: 'https://api.example.com', fetch });
    const result = await client.analyze({ token: 'active-token', profile, context });

    expect(result.quota.remaining).toBe(9);
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body.profile).not.toHaveProperty('consentAccepted');
    expect(body.profile).not.toHaveProperty('preferredFormats');
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer active-token' });
  });

  it('maps stable API failures without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          error: {
            code: 'quota_exhausted',
            message: 'Daily limit reached.',
            retryable: false,
            quotaConsumed: false,
          },
        },
        429,
      ),
    );
    const client = new CreatorCopilotApiClient({ baseUrl: 'https://api.example.com', fetch });

    await expect(client.analyze({ token: 'active-token', profile, context })).rejects.toEqual(
      expect.objectContaining({
        code: 'quota_exhausted',
        retryable: false,
        quotaConsumed: false,
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed success responses', async () => {
    const client = new CreatorCopilotApiClient({
      baseUrl: 'https://api.example.com',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ summary: 'not enough' })),
    });
    await expect(client.analyze({ token: 'active-token', profile, context })).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });
});

describe('validateApiBaseUrl', () => {
  it('requires HTTPS except for explicit local development', () => {
    expect(validateApiBaseUrl('https://api.example.com', false)).toBe('https://api.example.com');
    expect(() => validateApiBaseUrl('http://api.example.com', false)).toThrow();
    expect(validateApiBaseUrl('http://127.0.0.1:8787', true)).toBe('http://127.0.0.1:8787');
  });
});
