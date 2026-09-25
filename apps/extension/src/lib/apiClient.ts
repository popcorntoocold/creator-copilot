import {
  API_SCHEMA_VERSION,
  analysisRequestSchema,
  analysisResultSchema,
  apiErrorSchema,
  inviteRedemptionRequestSchema,
  inviteRedemptionResultSchema,
  type AnalysisResult,
  type ApiErrorCode,
  type CreatorProfile,
  type InviteRedemptionResult,
  type PageContext,
} from '@creator-copilot/shared';

type Fetch = typeof fetch;

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode,
    readonly retryable: boolean,
    readonly quotaConsumed?: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function validateApiBaseUrl(value: string, allowLocalhost: boolean): string {
  const url = new URL(value);
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(allowLocalhost && url.protocol === 'http:' && local)) {
    throw new Error('Creator Copilot API URL must use HTTPS.');
  }
  return url.toString().replace(/\/$/u, '');
}

export class CreatorCopilotApiClient {
  private readonly baseUrl: string;
  private readonly fetch: Fetch;
  private readonly timeoutMs: number;

  constructor(options: {
    baseUrl: string;
    fetch?: Fetch;
    timeoutMs?: number;
    allowLocalhost?: boolean;
  }) {
    this.baseUrl = validateApiBaseUrl(options.baseUrl, options.allowLocalhost ?? false);
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch (cause) {
      const message = cause instanceof DOMException && cause.name === 'AbortError'
        ? 'The request timed out. Retry when you are ready.'
        : 'Creator Copilot could not reach the AI service.';
      throw new ApiClientError(message, 'provider_unavailable', true, false);
    } finally {
      clearTimeout(timeout);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError('The service returned an unreadable response.', 'internal_error', true);
    }

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError('The service returned an unexpected error.', 'internal_error', true);
      }
      throw new ApiClientError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.retryable,
        parsed.data.error.quotaConsumed,
        parsed.data.error.requestId,
      );
    }
    return payload;
  }

  async redeemInvite(inviteCode: string, installationId: string): Promise<InviteRedemptionResult> {
    const body = inviteRedemptionRequestSchema.parse({ inviteCode, installationId });
    const payload = await this.request('/v1/invites/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const parsed = inviteRedemptionResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError('Activation returned an invalid response.', 'internal_error', true);
    }
    return parsed.data;
  }

  async analyze(input: {
    token: string | null;
    profile: CreatorProfile;
    context: PageContext;
  }): Promise<AnalysisResult> {
    if (!input.token) {
      throw new ApiClientError('Activate AI analysis first.', 'authentication_required', false, false);
    }
    const body = analysisRequestSchema.parse({
      schemaVersion: API_SCHEMA_VERSION,
      requestId: crypto.randomUUID(),
      mode: 'page_analysis',
      profile: {
        handle: input.profile.handle,
        displayName: input.profile.displayName,
        voice: input.profile.voice,
        allowedTopics: input.profile.allowedTopics,
        prohibitedTopics: input.profile.prohibitedTopics,
        monetizationDestination: input.profile.monetizationDestination,
        weeklyGoal: input.profile.weeklyGoal,
      },
      context: input.context,
    });
    const payload = await this.request('/v1/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.token}` },
      body: JSON.stringify(body),
    });
    const parsed = analysisResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError('AI analysis returned an invalid response.', 'invalid_provider_output', true, true);
    }
    return parsed.data;
  }

  async revoke(token: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}/v1/session`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok && response.status !== 401) {
        throw new ApiClientError('The session could not be revoked.', 'internal_error', true);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
