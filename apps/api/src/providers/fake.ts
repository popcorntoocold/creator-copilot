import {
  API_SCHEMA_VERSION,
  createRecommendations,
  type AnalysisPayload,
  type AnalysisRequest,
  type CreatorProfile,
  type PageContext,
} from '@creator-copilot/shared';
import type { AnalysisProvider, AnalysisProviderResult } from './types';

export class FakeAnalysisProvider implements AnalysisProvider {
  async analyze(request: AnalysisRequest): Promise<AnalysisProviderResult> {
    const profile: CreatorProfile = {
      ...request.profile,
      contentFrequency: 'Daily',
      preferredFormats: ['Post', 'Reply'],
      consentAccepted: true,
    };
    const metrics = Object.fromEntries(
      Object.entries(request.context.metrics).filter((entry): entry is [string, number] =>
        typeof entry[1] === 'number'),
    ) as PageContext['metrics'];
    const context: PageContext = {
      version: request.context.version,
      source: request.context.source,
      pageType: request.context.pageType,
      url: request.context.url,
      text: request.context.text,
      metrics,
      ...(request.context.handle ? { handle: request.context.handle } : {}),
      ...(request.context.displayName ? { displayName: request.context.displayName } : {}),
    };
    const recommendations = createRecommendations(context, profile).map((item) => ({
      ...item,
      status: 'ready' as const,
    }));
    const visibleMetrics = Object.entries(request.context.metrics)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([name, value]) => `${name}: ${value.toLocaleString('en-US')}`);

    const payload: AnalysisPayload = {
      schemaVersion: API_SCHEMA_VERSION,
      summary: `This ${request.context.pageType} has a concise, recognizable premise that can be tested with a clearer next action.`,
      evidence: [
        `The supplied public text contains ${request.context.text.length} characters.`,
        visibleMetrics.length ? `Visible metrics include ${visibleMetrics.join(', ')}.` : 'No public engagement counts were supplied.',
      ],
      recommendations,
      experiment: {
        id: 'specific-question-week',
        title: 'The specific-question week',
        hypothesis: 'Specific questions will create more useful public replies than generic prompts.',
        instructions: [
          'Publish three posts that each end with one precise, answerable question.',
          'Compare useful replies and qualified conversations with the prior week.',
        ],
        metric: 'Useful public replies and qualified conversations',
      },
      notices: ['Performance explanations are hypotheses based only on the context you supplied.'],
    };
    return { payload };
  }
}
