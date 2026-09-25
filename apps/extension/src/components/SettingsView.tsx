import { useState, type FormEvent } from 'react';
import type { CreatorProfile } from '@creator-copilot/shared';
import { Icon } from './Icon';
import type { AiSessionState } from '../state/auth';
import { ActivationCard } from './ActivationCard';

type SettingsViewProps = {
  profile: CreatorProfile;
  onSave: (profile: CreatorProfile) => void;
  onDelete: () => void;
  auth: AiSessionState;
  onActivate: (inviteCode: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SettingsView({ profile, onSave, onDelete, auth, onActivate, onSignOut }: SettingsViewProps) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function update<K extends keyof CreatorProfile>(key: K, value: CreatorProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(draft);
    setSaved(true);
  }

  return (
    <section>
      <div className="view-heading compact-heading">
        <div>
          <p className="soft-label">Your rules, not ours</p>
          <h1>Studio settings</h1>
          <p>Adjust the voice and boundaries applied before any draft is created.</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={submit}>
        <div className="settings-section">
          <h2>Public identity</h2>
          <div className="field-grid two-columns">
            <label>Public handle<input value={draft.handle} onChange={(event) => update('handle', event.target.value)} /></label>
            <label>Creator name<input value={draft.displayName} onChange={(event) => update('displayName', event.target.value)} /></label>
          </div>
        </div>
        <div className="settings-section">
          <h2>Voice and boundaries</h2>
          <label>Voice notes<textarea rows={3} value={draft.voice} onChange={(event) => update('voice', event.target.value)} /></label>
          <div className="field-grid two-columns">
            <label>Welcomed topics<textarea rows={3} value={draft.allowedTopics} onChange={(event) => update('allowedTopics', event.target.value)} /></label>
            <label>Hard boundaries<textarea rows={3} value={draft.prohibitedTopics} onChange={(event) => update('prohibitedTopics', event.target.value)} /></label>
          </div>
        </div>
        <div className="settings-section">
          <h2>Business direction</h2>
          <label>Primary destination<input value={draft.monetizationDestination} onChange={(event) => update('monetizationDestination', event.target.value)} /></label>
          <label>Weekly goal<input value={draft.weeklyGoal} onChange={(event) => update('weeklyGoal', event.target.value)} /></label>
        </div>
        <button className="primary-button" type="submit">Save changes</button>
        {saved ? <p className="success-note" role="status"><Icon name="check" size={16} /> Settings saved locally.</p> : null}
      </form>

      <ActivationCard auth={auth} onActivate={onActivate} onSignOut={onSignOut} />

      <div className="danger-zone">
        <div><h2>Delete local data</h2><p>Removes your profile, drafts, and experiment check-ins from this browser.</p></div>
        {confirmDelete ? (
          <div className="delete-confirmation">
            <button type="button" className="danger-button" onClick={onDelete}><Icon name="trash" size={16} /> Delete everything</button>
            <button type="button" className="quiet-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="quiet-button danger-text" onClick={() => setConfirmDelete(true)}>Review deletion</button>
        )}
      </div>
    </section>
  );
}
