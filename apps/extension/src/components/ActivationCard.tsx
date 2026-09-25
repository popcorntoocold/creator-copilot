import { useState, type FormEvent } from 'react';
import type { AiSessionState } from '../state/auth';
import { Icon } from './Icon';

type ActivationCardProps = {
  auth: AiSessionState;
  onActivate: (inviteCode: string) => Promise<void>;
  onSignOut?: () => Promise<void>;
  compact?: boolean;
};

export function ActivationCard({ auth, onActivate, onSignOut, compact = false }: ActivationCardProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function activate(event: FormEvent) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      await onActivate(code);
      setInviteCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This invite could not be activated.');
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === 'active' && auth.quota) {
    return (
      <div className={compact ? 'activation-seal is-active compact' : 'activation-seal is-active'}>
        <span className="seal-icon"><Icon name="sparkle" size={19} /></span>
        <div className="seal-copy">
          <strong>AI studio unlocked</strong>
          <span>{auth.quota.remaining} of {auth.quota.limit} analyses left today</span>
        </div>
        {onSignOut ? (
          <button className="quiet-button" type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form className={compact ? 'activation-seal compact' : 'activation-seal'} onSubmit={activate}>
      <span className="seal-icon"><Icon name="sparkle" size={19} /></span>
      <div className="seal-copy">
        <strong>{auth.status === 'expired' ? 'Your AI session expired' : auth.status === 'revoked' ? 'AI access was revoked' : 'Unlock the AI studio'}</strong>
        <span>Local planning stays available without an invite.</span>
        <label>
          Beta invite code
          <input
            autoComplete="off"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Enter your creator invite"
          />
        </label>
        {error ? <span className="activation-error" role="alert">{error}</span> : null}
      </div>
      <button className="primary-button" type="submit" disabled={busy || !inviteCode.trim()}>
        {busy ? 'Activating…' : 'Activate AI studio'}
      </button>
    </form>
  );
}
