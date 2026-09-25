import { describe, expect, it } from 'vitest';
import { analysisPayloadSchema, type AnalysisRequest } from '@creator-copilot/shared';
import { FakeAnalysisProvider } from './fake';

const request: AnalysisRequest = {
  schemaVersion: 1,
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  mode: 'page_analysis',
  profile: {
    handle: '@velvetpilot',
    displayName: 'Velvet Pilot',
    voice: 'confident, witty, concise',
    allowedTopics: 'luxury, routines, playful challenges',
    prohibitedTopics: 'debt, threats, protected traits',
    monetizationDestination: 'my verified creator page',
    weeklyGoal: 'Start 10 qualified conversations',
  },
  context: {
    version: 1,
    source: 'x',
    pageType: 'post',
    url: 'https://x.com/velvetpilot/status/123',
    handle: '@velvetpilot',
    displayName: 'Velvet Pilot',
    text: 'Quiet luxury is a standard, not a trend.',
    metrics: { likes: 42, views: 1200 },
  },
};

describe('FakeAnalysisProvider', () => {
  it('returns deterministic output through the production schema', async () => {
    const provider = new FakeAnalysisProvider();
    const first = await provider.analyze(request);
    const second = await provider.analyze(request);

    expect(first).toEqual(second);
    expect(analysisPayloadSchema.parse(first.payload)).toEqual(first.payload);
    expect(first.payload).toMatchObject({ recommendations: expect.any(Array) });
    expect((first.payload as { recommendations: unknown[] }).recommendations).toHaveLength(3);
  });
});
