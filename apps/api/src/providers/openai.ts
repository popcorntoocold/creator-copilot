import { analysisPayloadSchema, type AnalysisRequest } from '@creator-copilot/shared';
import { zodTextFormat } from 'openai/helpers/zod';
import { buildAnalysisInput, DEVELOPER_INSTRUCTIONS } from './prompt';
import type { AnalysisProvider, AnalysisProviderContext } from './types';

type OpenAIResponse = {
  output_parsed?: unknown;
  _request_id?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  } | null;
};

export type OpenAIResponsesClient = {
  responses: {
    parse(parameters: unknown, options?: unknown): Promise<OpenAIResponse>;
  };
};

export class OpenAIAnalysisProvider implements AnalysisProvider {
  constructor(
    private readonly options: {
      client: OpenAIResponsesClient;
      model: string;
      timeoutMs: number;
    },
  ) {
    if (!options.model.trim()) throw new Error('OPENAI_MODEL is required.');
    if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 60_000) {
      throw new Error('OpenAI timeout must be between 1000 and 60000 milliseconds.');
    }
  }

  async analyze(request: AnalysisRequest, context?: AnalysisProviderContext) {
    if (!context) throw new Error('OpenAI provider context is required.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.options.client.responses.parse(
        {
          model: this.options.model,
          store: false,
          max_output_tokens: 1800,
          reasoning: { effort: 'none' },
          safety_identifier: context.safetyIdentifier,
          input: [
            { role: 'developer', content: DEVELOPER_INSTRUCTIONS },
            { role: 'user', content: buildAnalysisInput(request) },
          ],
          text: {
            format: zodTextFormat(analysisPayloadSchema, 'creator_copilot_analysis'),
          },
        },
        {
          signal: controller.signal,
          headers: { 'X-Client-Request-Id': context.clientRequestId },
        },
      );
      const inputTokens = response.usage?.input_tokens;
      const outputTokens = response.usage?.output_tokens;
      return {
        payload: response.output_parsed ?? null,
        ...(Number.isSafeInteger(inputTokens) && Number.isSafeInteger(outputTokens)
          ? { usage: { inputTokens: inputTokens!, outputTokens: outputTokens! } }
          : {}),
        ...(response._request_id ? { providerRequestId: response._request_id } : {}),
      };
    } catch (cause) {
      throw new Error('OpenAI request failed.', { cause });
    } finally {
      clearTimeout(timeout);
    }
  }
}
