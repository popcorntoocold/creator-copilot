import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ViewName = 'today' | 'analyze' | 'create' | 'experiments' | 'settings';

const navigation: Array<{ id: ViewName; label: string; icon: IconName }> = [
  { id: 'today', label: 'Today', icon: 'gauge' },
  { id: 'analyze', label: 'Analyze', icon: 'analyze' },
  { id: 'create', label: 'Create', icon: 'create' },
  { id: 'experiments', label: 'Experiments', icon: 'experiment' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

type AppShellProps = {
  activeView: ViewName;
  onNavigate: (view: ViewName) => void;
  completed: number;
  aiActive?: boolean;
  children: ReactNode;
};

export function AppShell({ activeView, onNavigate, completed, aiActive = false, children }: AppShellProps) {
  const progress = Math.min(100, Math.round((completed / 3) * 100));

  return (
    <div className="app-shell">
      <aside className="studio-ribbon" aria-label={`Daily progress: ${completed} of 3 actions`}>
        <div className="ribbon-mark"><Icon name="feather" size={17} /></div>
        <div className="ribbon-track" aria-hidden="true">
          <span style={{ height: `${progress}%` }} />
        </div>
        <strong>{completed}/3</strong>
      </aside>

      <div className="app-stage">
        <header className="brand-header">
          <div>
            <p className="brand-name">Creator Copilot</p>
            <p className="brand-subtitle">Your private working studio</p>
          </div>
          <span className={aiActive ? 'local-badge ai-badge' : 'local-badge'}>
            {aiActive ? 'AI beta' : 'Local mode'}
          </span>
        </header>

        <nav className="view-nav" aria-label="Creator Copilot views">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? 'nav-item is-active' : 'nav-item'}
              aria-current={activeView === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <main className="view-content">{children}</main>
      </div>
    </div>
  );
}
