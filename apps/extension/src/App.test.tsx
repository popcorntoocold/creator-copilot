import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreatorProfile, PageContext } from '@creator-copilot/shared';
import { App } from './App';
import type { CreatorCopilotApiClient } from './lib/apiClient';
import { initialCreatorState } from './state/defaults';

const profile: CreatorProfile = {
  handle: '@velvetpilot',
  displayName: 'Velvet Pilot',
  voice: 'confident, witty, concise',
  allowedTopics: 'luxury, routines, playful challenges',
  prohibitedTopics: 'debt, threats, protected traits',
  contentFrequency: 'Daily',
  preferredFormats: ['Post', 'Reply'],
  monetizationDestination: 'my verified creator page',
  weeklyGoal: 'Start 10 qualified conversations',
  consentAccepted: true,
};

const postContext: PageContext = {
  version: 1,
  source: 'x',
  pageType: 'post',
  url: 'https://x.com/velvetpilot/status/123',
  handle: '@velvetpilot',
  displayName: 'Velvet Pilot',
  text: 'Quiet luxury is a standard, not a trend.',
  metrics: { likes: 42, views: 1200 },
};

afterEach(() => cleanup());

describe('App', () => {
  it('requires consent before saving onboarding', async () => {
    const user = userEvent.setup();
    render(<App initialState={initialCreatorState} />);

    await user.click(screen.getByRole('button', { name: /save and enter/i }));

    expect(screen.getByText(/confirm the privacy disclosure/i)).toBeVisible();
  });

  it('previews extracted context before creating drafts', async () => {
    const user = userEvent.setup();
    const requestPageContext = vi.fn().mockResolvedValue({ ok: true, context: postContext });
    render(
      <App
        initialState={{ ...initialCreatorState, profile }}
        requestPageContext={requestPageContext}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await user.click(screen.getByRole('button', { name: /analyze this page/i }));

    expect(await screen.findByText(postContext.text)).toBeVisible();
    expect(screen.getByRole('button', { name: /create recommendations locally/i })).toBeVisible();
    expect(screen.queryByText(/turn the premise into a sharper opener/i)).not.toBeInTheDocument();
  });

  it('creates drafts only after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <App
        initialState={{ ...initialCreatorState, profile }}
        requestPageContext={vi.fn().mockResolvedValue({ ok: true, context: postContext })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await user.click(screen.getByRole('button', { name: /analyze this page/i }));
    await user.click(
      await screen.findByRole('button', { name: /create recommendations locally/i }),
    );

    expect(screen.getByText(/turn the premise into a sharper opener/i)).toBeVisible();
  });

  it('does not call AI until the creator confirms the displayed context', async () => {
    const user = userEvent.setup();
    const analyze = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      summary: 'A concise premise.',
      evidence: ['The supplied text is short.'],
      recommendations: [
        { id: '1', kind: 'hook', title: 'AI hook', rationale: 'Why', draft: 'Draft 1', copyable: true, requiresReview: true, status: 'ready' },
        { id: '2', kind: 'reply', title: 'AI reply', rationale: 'Why', draft: 'Draft 2', copyable: true, requiresReview: true, status: 'ready' },
        { id: '3', kind: 'follow_up', title: 'AI follow-up', rationale: 'Why', draft: 'Draft 3', copyable: true, requiresReview: true, status: 'ready' },
      ],
      experiment: { id: 'e1', title: 'Test', hypothesis: 'Hypothesis', instructions: ['Do it'], metric: 'Replies' },
      notices: ['This is a hypothesis.'],
      quota: { remaining: 9, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
    });
    const apiClient = { analyze, redeemInvite: vi.fn(), revoke: vi.fn() } as unknown as CreatorCopilotApiClient;
    render(
      <App
        initialState={{
          ...initialCreatorState,
          profile,
          auth: {
            status: 'active',
            installationId: '123e4567-e89b-42d3-a456-426614174000',
            token: 'active-token',
            expiresAt: '2026-10-24T12:00:00.000Z',
            quota: { remaining: 10, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
          },
        }}
        requestPageContext={vi.fn().mockResolvedValue({ ok: true, context: postContext })}
        apiClient={apiClient}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await user.click(screen.getByRole('button', { name: /analyze this page/i }));
    expect(analyze).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /send for ai analysis/i }));

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('AI hook')).toBeVisible();
    expect(screen.getByText(/9 of 10 analyses left/i)).toBeVisible();
  });

  it('preserves the confirmed preview for an explicit retry', async () => {
    const user = userEvent.setup();
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('AI is temporarily unavailable.'), { retryable: true }))
      .mockResolvedValueOnce({
        schemaVersion: 1,
        summary: 'A concise premise.',
        evidence: ['Evidence'],
        recommendations: [
          { id: '1', kind: 'hook', title: 'Recovered hook', rationale: 'Why', draft: 'Draft 1', copyable: true, requiresReview: true, status: 'ready' },
          { id: '2', kind: 'reply', title: 'Reply', rationale: 'Why', draft: 'Draft 2', copyable: true, requiresReview: true, status: 'ready' },
          { id: '3', kind: 'follow_up', title: 'Follow-up', rationale: 'Why', draft: 'Draft 3', copyable: true, requiresReview: true, status: 'ready' },
        ],
        experiment: { id: 'e1', title: 'Test', hypothesis: 'Hypothesis', instructions: ['Do it'], metric: 'Replies' },
        notices: [],
        quota: { remaining: 8, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
      });
    const apiClient = { analyze, redeemInvite: vi.fn(), revoke: vi.fn() } as unknown as CreatorCopilotApiClient;
    render(
      <App
        initialState={{
          ...initialCreatorState,
          profile,
          auth: {
            status: 'active',
            installationId: '123e4567-e89b-42d3-a456-426614174000',
            token: 'active-token',
            expiresAt: '2026-10-24T12:00:00.000Z',
            quota: { remaining: 9, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
          },
        }}
        requestPageContext={vi.fn().mockResolvedValue({ ok: true, context: postContext })}
        apiClient={apiClient}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await user.click(screen.getByRole('button', { name: /analyze this page/i }));
    await user.click(await screen.findByRole('button', { name: /send for ai analysis/i }));
    expect(await screen.findByRole('button', { name: /retry ai analysis/i })).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /retry ai analysis/i }));
    expect(await screen.findByText('Recovered hook')).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(2);
  });
});
