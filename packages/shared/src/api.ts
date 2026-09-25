import { z } from 'zod';

export const API_SCHEMA_VERSION = 1 as const;

const boundedString = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalBoundedString = (maximum: number) => boundedString(maximum).optional();

const xUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'x.com' || url.hostname === 'www.x.com');
  }, 'Expected a public x.com URL');

export const analysisProfileSchema = z
  .object({
    handle: boundedString(50),
    displayName: boundedString(100),
    voice: boundedString(1200),
    allowedTopics: boundedString(1200),
    prohibitedTopics: boundedString(1200),
    monetizationDestination: boundedString(500),
    weeklyGoal: boundedString(500),
  })
  .strict();

const metricsSchema = z
  .object({
    replies: z.number().int().nonnegative().max(1_000_000_000).optional(),
    reposts: z.number().int().nonnegative().max(1_000_000_000).optional(),
    likes: z.number().int().nonnegative().max(1_000_000_000).optional(),
    views: z.number().int().nonnegative().max(1_000_000_000_000).optional(),
  })
  .strict();

export const pageContextSchema = z
  .object({
    version: z.literal(1),
    source: z.literal('x'),
    pageType: z.enum(['profile', 'post', 'feed']),
    url: xUrlSchema,
    handle: optionalBoundedString(50),
    displayName: optionalBoundedString(100),
    text: boundedString(1800),
    metrics: metricsSchema,
  })
  .strict();

export const analysisRequestSchema = z
  .object({
    schemaVersion: z.literal(API_SCHEMA_VERSION),
    requestId: z.uuid(),
    mode: z.literal('page_analysis'),
    profile: analysisProfileSchema,
    context: pageContextSchema,
  })
  .strict();

export const recommendationSchema = z
  .object({
    id: boundedString(100),
    kind: z.enum(['hook', 'reply', 'follow_up', 'boundary']),
    title: boundedString(120),
    rationale: boundedString(600),
    draft: z.string().trim().max(500),
    copyable: z.boolean(),
    requiresReview: z.literal(true),
    status: z.literal('ready'),
  })
  .strict();

export const suggestedExperimentSchema = z
  .object({
    id: boundedString(100),
    title: boundedString(120),
    hypothesis: boundedString(500),
    instructions: z.array(boundedString(300)).min(1).max(4),
    metric: boundedString(160),
  })
  .strict();

export const quotaSchema = z
  .object({
    remaining: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    resetsAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((value) => value.remaining <= value.limit, 'Remaining quota exceeds limit');

export const analysisResultSchema = z
  .object({
    schemaVersion: z.literal(API_SCHEMA_VERSION),
    summary: boundedString(800),
    evidence: z.array(boundedString(400)).min(1).max(5),
    recommendations: z.array(recommendationSchema).length(3),
    experiment: suggestedExperimentSchema,
    notices: z.array(boundedString(300)).max(5),
    quota: quotaSchema,
  })
  .strict();

export const analysisPayloadSchema = analysisResultSchema.omit({ quota: true });

export const inviteRedemptionRequestSchema = z
  .object({
    inviteCode: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
    installationId: z.uuid(),
  })
  .strict();

export const inviteRedemptionResultSchema = z
  .object({
    schemaVersion: z.literal(API_SCHEMA_VERSION),
    token: boundedString(512),
    expiresAt: z.string().datetime({ offset: true }),
    quota: quotaSchema,
  })
  .strict();

export const apiErrorCodeSchema = z.enum([
  'invalid_request',
  'not_found',
  'method_not_allowed',
  'origin_not_allowed',
  'invite_invalid',
  'authentication_required',
  'session_expired',
  'session_revoked',
  'quota_exhausted',
  'unsafe_context',
  'provider_unavailable',
  'invalid_provider_output',
  'internal_error',
]);

export const apiErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: boundedString(240),
        requestId: z.uuid().optional(),
        retryable: z.boolean(),
        quotaConsumed: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

export type AnalysisProfile = z.infer<typeof analysisProfileSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisPayload = z.infer<typeof analysisPayloadSchema>;
export type SuggestedExperiment = z.infer<typeof suggestedExperimentSchema>;
export type InviteRedemptionRequest = z.infer<typeof inviteRedemptionRequestSchema>;
export type InviteRedemptionResult = z.infer<typeof inviteRedemptionResultSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
