import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivationCard } from './ActivationCard';
import { initialAuthState } from '../state/auth';

afterEach(() => cleanup());

describe('ActivationCard', () => {
  it('submits an invite without displaying it again', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn().mockResolvedValue(undefined);
    render(<ActivationCard auth={initialAuthState} onActivate={onActivate} />);

    const input = screen.getByLabelText(/beta invite code/i);
    await user.type(input, 'creator-beta-1234567890');
    await user.click(screen.getByRole('button', { name: /activate ai studio/i }));

    expect(onActivate).toHaveBeenCalledWith('creator-beta-1234567890');
    expect(input).toHaveValue('');
  });

  it('shows the active quota instead of an invite field', () => {
    render(
      <ActivationCard
        auth={{
          status: 'active',
          installationId: '123e4567-e89b-42d3-a456-426614174000',
          token: 'session-token',
          expiresAt: '2026-10-24T12:00:00.000Z',
          quota: { remaining: 7, limit: 10, resetsAt: '2026-09-25T00:00:00.000Z' },
        }}
        onActivate={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByText(/7 of 10 analyses left/i)).toBeVisible();
    expect(screen.queryByLabelText(/beta invite code/i)).not.toBeInTheDocument();
  });
});
