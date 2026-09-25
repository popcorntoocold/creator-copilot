import { useState } from 'react';
import type { AnalysisResult, CreatorProfile, PageContext, Recommendation } from '@creator-copilot/shared';
import { createRecommendations } from '@creator-copilot/shared';
import type { ClientExtractionResult } from '../lib/chromeClient';
import { Icon } from './Icon';
import { RecommendationCard } from './RecommendationCard';
import type { AiSessionState } from '../state/auth';
import { ActivationCard } from './ActivationCard';

type AnalyzeViewProps = {
  profile: CreatorProfile;
  recommendations: Recommendation[];
  requestContext: () => Promise<ClientExtractionResult>;
  onContext: (context: PageContext | null) => void;
  onRecommendations: (recommendations: Recommendation[]) => void;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  auth: AiSessionState;
  onActivate: (inviteCode: string) => Promise<void>;
  requestAiAnalysis: (context: PageContext) => Promise<AnalysisResult>;
};

const errorCopy: Record<string, string> = {
  unsupported_site: 'Open a public page on x.com, then try again.',
  private_route: 'Private-message pages are intentionally unavailable. Open a public post or profile.',
  page_not_recognized: 'This X page is not recognizable yet. Try a public profile or an individual post.',
  no_active_tab: 'No active browser tab was found.',
  permission_denied: 'Chrome did not grant temporary page access. Reopen the extension from the toolbar.',
  extension_unavailable: 'Page analysis works after the built extension is loaded in Chrome.',
};

export function AnalyzeView({
  profile,
  recommendations,
  requestContext,
  onContext,
  onRecommendations,
  onComplete,
  onDismiss,
  auth,
  onActivate,
  requestAiAnalysis,
}: AnalyzeViewProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'ai-loading' | 'ai-error' | 'complete' | 'error'>('idle');
  const [context, setContext] = useState<PageContext | null>(null);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);

  async function analyze() {
    setStatus('loading');
    setError('');
    const result = await requestContext();
    if (!result.ok) {
      setError(errorCopy[result.reason] ?? 'The page could not be analyzed.');
      setStatus('error');
      return;
    }
    setContext(result.context);
    onContext(result.context);
    setStatus('preview');
  }

  function confirmLocal() {
    if (!context) return;
    onRecommendations(createRecommendations(context, profile));
    setStatus('complete');
  }

  async function confirmAi() {
    if (!context) return;
    setStatus('ai-loading');
    setError('');
    setRetryable(false);
    try {
      const result = await requestAiAnalysis(context);
      onRecommendations(result.recommendations);
      setStatus('complete');
    } catch (cause) {
      const failure = cause as Error & { retryable?: boolean; quotaConsumed?: boolean };
      setError(failure.message || 'AI analysis could not be completed.');
      setRetryable(Boolean(failure.retryable));
      setStatus('ai-error');
    }
  }

  return (
    <section>
      <div className="view-heading compact-heading">
        <div>
          <p className="soft-label">Public context, on demand</p>
          <h1>Analyze what you chose.</h1>
          <p>Nothing is read until you press the button. You confirm the preview before drafts appear.</p>
        </div>
      </div>

      {auth.status !== 'active' ? (
        <ActivationCard auth={auth} onActivate={onActivate} compact />
      ) : null}

      <div className="analysis-console">
        <div className="console-topline">
          <span><i className={`status-dot status-${status}`} /> {status === 'idle' ? 'Waiting for a page' : status}</span>
          <span>
            {auth.status === 'active' && auth.quota
              ? `${auth.quota.remaining} of ${auth.quota.limit} analyses left`
              : 'Public X only'}
          </span>
        </div>

        {status === 'idle' || status === 'error' ? (
          <div className="analysis-start">
            <span className="analysis-orbit"><Icon name="analyze" size={28} /></span>
            <h2>Open a profile or post on X.</h2>
            <p>Copilot reads only a small set of visible fields after this explicit request.</p>
            {error ? <p className="inline-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="button" onClick={analyze}>
              Analyze this page <Icon name="sparkle" size={17} />
            </button>
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="analysis-start" aria-live="polite">
            <span className="loading-mark" />
            <h2>Reading visible public context…</h2>
          </div>
        ) : null}

        {context && ['preview', 'ai-loading', 'ai-error', 'complete'].includes(status) ? (
          <div className="context-preview">
            <div className="preview-heading">
              <div><span>Detected {context.pageType}</span><strong>{context.handle ?? 'Public X page'}</strong></div>
              <span className="privacy-chip">Session only</span>
            </div>
            <p className="preview-text">{context.text}</p>
            <dl className="preview-metrics">
              {Object.entries(context.metrics).map(([key, value]) => (
                <div key={key}><dt>{key}</dt><dd>{value?.toLocaleString()}</dd></div>
              ))}
            </dl>
            {status === 'preview' || status === 'ai-loading' || status === 'ai-error' ? (
              <div className="confirmation-strip">
                <p>
                  <strong>Confirm this context?</strong>{' '}
                  {auth.status === 'active'
                    ? 'The displayed fields will be sent to Creator Copilot and OpenAI only after you choose AI analysis.'
                    : 'Raw page text stays in this sidebar session when you create locally.'}
                </p>
                {error ? <p className="inline-error" role="alert">{error}</p> : null}
                <div>
                  {auth.status === 'active' ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={status === 'ai-loading'}
                      onClick={() => void confirmAi()}
                    >
                      {status === 'ai-loading'
                        ? 'Creating AI analysis…'
                        : status === 'ai-error' && retryable
                          ? 'Retry AI analysis'
                          : 'Send for AI analysis'}
                    </button>
                  ) : null}
                  <button className={auth.status === 'active' ? 'secondary-button' : 'primary-button'} type="button" onClick={confirmLocal}>
                    Create recommendations locally
                  </button>
                  <button className="quiet-button" type="button" onClick={() => { setContext(null); onContext(null); setStatus('idle'); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {status === 'complete' ? (
        <div className="recommendation-stack analysis-results">
          {recommendations.map((item) => (
            <RecommendationCard
              key={item.id}
              recommendation={item}
              onComplete={onComplete}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
