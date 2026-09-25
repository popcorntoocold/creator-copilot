import { describe, expect, it } from 'vitest';
import { initialCreatorState } from './defaults';
import { createMemoryAdapter, loadPersistentState, savePersistentState } from './store';
import { createRecommendations } from '@creator-copilot/shared';

const pageContext = {
  version: 1 as const,
  source: 'x' as const,
  pageType: 'post' as const,
  url: 'https://x.com/sample/status/1',
  text: 'raw public post text that must remain session-only',
  metrics: {},
};

describe('persistent state', () => {
  it('never includes raw page context in persisted state', async () => {
    const adapter = createMemoryAdapter();

    await savePersistentState(
      { ...initialCreatorState, sessionContext: pageContext },
      adapter,
    );

    expect(adapter.inspect()).not.toHaveProperty('sessionContext');
    expect(JSON.stringify(adapter.inspect())).not.toContain(pageContext.text);
  });

  it('restores persisted recommendations and experiment state', async () => {
    const adapter = createMemoryAdapter();
    const state = {
      ...initialCreatorState,
      recommendations: [
        {
          id: 'saved',
          kind: 'reply' as const,
          title: 'Saved reply',
          rationale: 'Useful later',
          draft: 'A saved draft',
          copyable: true,
          requiresReview: true as const,
          status: 'ready' as const,
        },
      ],
    };
    await savePersistentState(state, adapter);

    await expect(loadPersistentState(adapter)).resolves.toMatchObject({
      recommendations: [{ id: 'saved' }],
      sessionContext: null,
    });
  });

  it('does not retain a unique source-text sentinel through generated drafts', async () => {
    const sentinel = 'RAW_CONTEXT_SENTINEL_93812';
    const adapter = createMemoryAdapter();
    const profile = {
      handle: '@sample',
      displayName: 'Sample',
      voice: 'confident and concise',
      allowedTopics: 'routines',
      prohibitedTopics: 'debt, threats',
      contentFrequency: 'Daily',
      preferredFormats: ['Post'],
      monetizationDestination: 'my verified creator page',
      weeklyGoal: 'Test three posts',
      consentAccepted: true,
    };
    const recommendations = createRecommendations({ ...pageContext, text: sentinel }, profile);

    await savePersistentState(
      { ...initialCreatorState, profile, recommendations, sessionContext: { ...pageContext, text: sentinel } },
      adapter,
    );

    expect(JSON.stringify(adapter.inspect())).not.toContain(sentinel);
  });

  it('persists the installation session but never an invite code', async () => {
    const adapter = createMemoryAdapter();
    await savePersistentState(
      {
        ...initialCreatorState,
        auth: {
          status: 'active',
          installationId: '123e4567-e89b-42d3-a456-426614174000',
          token: 'session-token',
          expiresAt: '2026-10-24T12:00:00.000Z',
          quota: { remaining: 10, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
        },
      },
      adapter,
    );

    expect(adapter.inspect()).toMatchObject({ auth: { status: 'active', token: 'session-token' } });
    expect(JSON.stringify(adapter.inspect())).not.toMatch(/inviteCode|creator-beta/i);
  });
});
