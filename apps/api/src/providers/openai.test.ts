import { describe, expect, it, vi } from 'vitest';
import { analysisPayloadSchema, type AnalysisRequest } from '@creator-copilot/shared';
import { FakeAnalysisProvider } from './fake';
import { OpenAIAnalysisProvider } from './openai';

const request: AnalysisRequest = {
  schemaVersion: 1,
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  mode: 'page_analysis',
  profile: {
    handle: '@velvetpilot',
    displayName: 'Velvet Pilot',
    voice: 'confident, witty, concise',
    allowedTopics: 'luxury',
    prohibitedTopics: 'debt and threats',
    monetizationDestination: 'verified creator page',
    weeklyGoal: 'Five useful conversations',
  },
  context: {
    version: 1,
    source: 'x',
    pageType: 'post',
    url: 'https://x.com/velvetpilot/status/123',
    text: 'Quiet luxury is the standard.',
    metrics: { views: 1200 },
  },
};

async function validPayload() {
  return (await new FakeAnalysisProvider().analyze(request)).payload;
}

describe('OpenAIAnalysisProvider', () => {
  it('uses Responses structured output with separated untrusted input', async () => {
    const payload = await validPayload();
    const parse = vi.fn().mockResolvedValue({
      output_parsed: payload,
      _request_id: 'req_123',
      usage: { input_tokens: 321, output_tokens: 123, total_tokens: 444 },
    });
    const provider = new OpenAIAnalysisProvider({
      client: { responses: { parse } },
      model: 'gpt-6-luna',
      timeoutMs: 15_000,
    });

    const result = await provider.analyze(request, {
      safetyIdentifier: 'cc_installation-123',
      clientRequestId: request.requestId,
    });

    expect(analysisPayloadSchema.parse(result.payload)).toEqual(payload);
    expect(result).toMatchObject({
      usage: { inputTokens: 321, outputTokens: 123 },
      providerRequestId: 'req_123',
    });
    expect(parse).toHaveBeenCalledTimes(1);
    const call = parse.mock.calls[0];
    expect(call).toBeDefined();
    const parameters = call![0];
    const options = call![1];
    expect(parameters).toMatchObject({
      model: 'gpt-6-luna',
      store: false,
      max_output_tokens: 1800,
      reasoning: { effort: 'none' },
      safety_identifier: 'cc_installation-123',
      text: { format: { type: 'json_schema' } },
    });
    expect(parameters.input[0]).toMatchObject({ role: 'developer' });
    expect(parameters.input[1]).toMatchObject({ role: 'user' });
    expect(parameters.input[0].content).not.toContain(request.context.text);
    expect(parameters.input[1].content).toContain(request.context.text);
    expect(options.headers).toEqual({ 'X-Client-Request-Id': request.requestId });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns an invalid value for refusals or empty structured output without retrying', async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: null, _request_id: 'req_refused' });
    const provider = new OpenAIAnalysisProvider({
      client: { responses: { parse } },
      model: 'gpt-6-luna',
      timeoutMs: 15_000,
    });

    expect(
      await provider.analyze(request, {
        safetyIdentifier: 'cc_installation-123',
        clientRequestId: request.requestId,
      }),
    ).toMatchObject({ payload: null, providerRequestId: 'req_refused' });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('propagates a transport failure without exposing or retrying it', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('upstream secret response'));
    const provider = new OpenAIAnalysisProvider({
      client: { responses: { parse } },
      model: 'gpt-6-luna',
      timeoutMs: 15_000,
    });

    await expect(
      provider.analyze(request, {
        safetyIdentifier: 'cc_installation-123',
        clientRequestId: request.requestId,
      }),
    ).rejects.toThrow('OpenAI request failed.');
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
