import { classifyWithPangram, type Env } from './index';

const env: Env = { PANGRAM_API_KEY: 'key', SCREENER_TOKEN: 'token', PANGRAM_BASE_URL: 'https://pangram.test' };

function fakePangram(stages: object[]) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    if (init?.method === 'POST') return Response.json({ task_id: 't1' });
    return Response.json(stages.shift());
  }) as typeof fetch;
  return { fetcher, calls };
}

describe('classifyWithPangram', () => {
  it('creates a task and polls until success', async () => {
    const { fetcher, calls } = fakePangram([
      { stage: 'STAGE_PENDING' },
      { stage: 'STAGE_SUCCESS', prediction_short: 'AI', fraction_ai: 0.92, fraction_ai_assisted: 0.05, fraction_human: 0.03, headline: 'AI Detected' },
    ]);
    const result = await classifyWithPangram('hello', env, fetcher, async () => {});
    expect(result).toEqual({ prediction: 'AI', fractionAi: 0.92, fractionAiAssisted: 0.05, fractionHuman: 0.03, headline: 'AI Detected' });
    expect(calls).toEqual(['POST https://pangram.test/task', 'GET https://pangram.test/task/t1', 'GET https://pangram.test/task/t1']);
  });

  it('throws when the task fails', async () => {
    const { fetcher } = fakePangram([{ stage: 'STAGE_FAILED' }]);
    await expect(classifyWithPangram('hello', env, fetcher, async () => {})).rejects.toThrow('Pangram task failed');
  });
});
