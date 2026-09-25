import { describe, expect, it } from 'vitest';
import {
  API_SCHEMA_VERSION,
  analysisRequestSchema,
  analysisResultSchema,
  inviteRedemptionRequestSchema,
} from './api';

const validRequest = {
  schemaVersion: API_SCHEMA_VERSION,
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
} as const;

const recommendation = {
  id: 'hook-1',
  kind: 'hook',
  title: 'Sharpen the opening',
  rationale: 'The existing premise is recognizable but can become more specific.',
  draft: 'Quiet luxury is not a trend. It is the standard.',
  copyable: true,
  requiresReview: true,
  status: 'ready',
} as const;

describe('analysisRequestSchema', () => {
  it('accepts a bounded versioned request', () => {
    expect(analysisRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('rejects unknown and unsupported fields', () => {
    expect(() => analysisRequestSchema.parse({ ...validRequest, secret: 'nope' })).toThrow();
    expect(() => analysisRequestSchema.parse({ ...validRequest, schemaVersion: 2 })).toThrow();
  });

  it('rejects oversized text and non-X URLs', () => {
    expect(() =>
      analysisRequestSchema.parse({
        ...validRequest,
        context: { ...validRequest.context, text: 'x'.repeat(1801) },
      }),
    ).toThrow();
    expect(() =>
      analysisRequestSchema.parse({
        ...validRequest,
        context: { ...validRequest.context, url: 'https://example.com/post/1' },
      }),
    ).toThrow();
  });

  it('rejects excessive metrics and profile fields that are not transmitted', () => {
    expect(() =>
      analysisRequestSchema.parse({
        ...validRequest,
        context: { ...validRequest.context, metrics: { ...validRequest.context.metrics, likes: -1 } },
      }),
    ).toThrow();
    expect(() =>
      analysisRequestSchema.parse({
        ...validRequest,
        profile: { ...validRequest.profile, consentAccepted: true },
      }),
    ).toThrow();
  });
});

describe('analysisResultSchema', () => {
  it('accepts a complete structured result', () => {
    const result = {
      schemaVersion: API_SCHEMA_VERSION,
      summary: 'The post is concise and has a clearly recognizable point of view.',
      evidence: ['The opening is under ten words.', 'The view count is visible in the supplied context.'],
      recommendations: [
        recommendation,
        { ...recommendation, id: 'reply-1', kind: 'reply', title: 'Invite a specific reply' },
        { ...recommendation, id: 'follow-up-1', kind: 'follow_up', title: 'Publish a follow-up' },
      ],
      experiment: {
        id: 'specific-question-week',
        title: 'Specific-question week',
        hypothesis: 'Specific questions will create more useful replies.',
        instructions: ['Publish three posts with one precise question.'],
        metric: 'Useful public replies',
      },
      notices: ['Performance explanations are hypotheses, not causal proof.'],
      quota: { remaining: 9, limit: 10, resetsAt: '2026-09-26T00:00:00.000Z' },
    };

    expect(analysisResultSchema.parse(result)).toEqual(result);
  });

  it('requires exactly three bounded recommendations', () => {
    const base = {
      schemaVersion: API_SCHEMA_VERSION,
      summary: 'Summary',
      evidence: ['Evidence'],
      recommendations: [recommendation],
      experiment: {
        id: 'experiment',
        title: 'Experiment',
        hypothesis: 'Hypothesis',
        instructions: ['Instruction'],
        metric: 'Metric',
      },
      notices: [],
      quota: { remaining: 9, limit: 10, resetsAt: '2026-09-26T00:00:00.000Z' },
    };

    expect(() => analysisResultSchema.parse(base)).toThrow();
  });
});

describe('inviteRedemptionRequestSchema', () => {
  it('accepts a bounded invite and UUID installation id', () => {
    expect(
      inviteRedemptionRequestSchema.parse({
        inviteCode: 'creator-beta-1234567890',
        installationId: '123e4567-e89b-42d3-a456-426614174000',
      }),
    ).toEqual({
      inviteCode: 'creator-beta-1234567890',
      installationId: '123e4567-e89b-42d3-a456-426614174000',
    });
  });

  it('rejects short codes and non-UUID installation ids', () => {
    expect(() =>
      inviteRedemptionRequestSchema.parse({ inviteCode: 'short', installationId: 'device-1' }),
    ).toThrow();
  });
});
