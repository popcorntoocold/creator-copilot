import { describe, expect, it } from 'vitest';
import type { Recommendation } from '@creator-copilot/shared';
import { creatorReducer } from './reducer';
import { initialCreatorState } from './defaults';

const recommendation: Recommendation = {
  id: 'rec-1',
  kind: 'hook',
  title: 'Sharpen the opener',
  rationale: 'A clearer contrast earns attention.',
  draft: 'Standards are visible in the details.',
  copyable: true,
  requiresReview: true,
  status: 'ready',
};

describe('creatorReducer', () => {
  it('marks a recommendation complete without changing its draft', () => {
    const state = { ...initialCreatorState, recommendations: [recommendation] };
    const next = creatorReducer(state, { type: 'complete_recommendation', id: 'rec-1' });

    expect(next.recommendations[0]).toMatchObject({
      id: 'rec-1',
      draft: recommendation.draft,
      status: 'completed',
    });
  });

  it('records an experiment check-in', () => {
    const next = creatorReducer(initialCreatorState, {
      type: 'check_in_experiment',
      outcome: 'up',
      note: 'More profile visits after specific questions.',
    });

    expect(next.experiment.checkIns).toHaveLength(1);
    expect(next.experiment.checkIns[0]).toMatchObject({ outcome: 'up' });
  });

  it('deletes all local creator data', () => {
    const dirty = {
      ...initialCreatorState,
      recommendations: [recommendation],
      sessionContext: {
        version: 1 as const,
        source: 'x' as const,
        pageType: 'post' as const,
        url: 'https://x.com/a/status/1',
        text: 'public post',
        metrics: {},
      },
    };

    expect(creatorReducer(dirty, { type: 'delete_local_data' })).toEqual(initialCreatorState);
  });

  it('activates, updates quota, and signs out without deleting creator work', () => {
    const active = creatorReducer(initialCreatorState, {
      type: 'activate_ai',
      installationId: '123e4567-e89b-42d3-a456-426614174000',
      token: 'session-token',
      expiresAt: '2026-10-24T12:00:00.000Z',
      quota: { remaining: 10, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
    });
    const updated = creatorReducer(active, {
      type: 'set_ai_quota',
      quota: { remaining: 9, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
    });
    const signedOut = creatorReducer(
      { ...updated, recommendations: [recommendation] },
      { type: 'clear_ai_session', status: 'inactive' },
    );

    expect(active.auth).toMatchObject({ status: 'active', token: 'session-token' });
    expect(updated.auth.quota?.remaining).toBe(9);
    expect(signedOut.auth).toEqual(initialCreatorState.auth);
    expect(signedOut.recommendations).toEqual([recommendation]);
  });
});
