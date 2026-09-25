// Proxies AI-detection requests from the extension to Pangram so the API key never ships in the extension.

export interface Env {
  PANGRAM_API_KEY: string;
  SCREENER_TOKEN: string;
  PANGRAM_BASE_URL?: string;
}

export interface Classification {
  prediction: 'AI' | 'Mixed' | 'Human';
  fractionAi: number;
  fractionAiAssisted: number;
  fractionHuman: number;
  headline: string;
}

interface PangramTask {
  stage?: string;
  prediction_short?: Classification['prediction'];
  fraction_ai?: number;
  fraction_ai_assisted?: number;
  fraction_human?: number;
  headline?: string;
}

const MAX_TEXT = 5000;
const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 25_000;
const CACHE_TTL_S = 60 * 60 * 24 * 30;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-screener-token',
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS, ...headers },
  });
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function classifyWithPangram(
  text: string,
  env: Env,
  fetcher: typeof fetch = fetch,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Classification> {
  const base = env.PANGRAM_BASE_URL ?? 'https://text.external-api.pangram.com';
  const headers = { 'content-type': 'application/json', 'x-api-key': env.PANGRAM_API_KEY };

  const created = await fetcher(`${base}/task`, { method: 'POST', headers, body: JSON.stringify({ text }) });
  if (!created.ok) throw new Error(`Pangram create failed: ${created.status}`);
  const { task_id } = (await created.json()) as { task_id?: string };
  if (!task_id) throw new Error('Pangram returned no task_id');

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const polled = await fetcher(`${base}/task/${task_id}`, { headers });
    if (!polled.ok) throw new Error(`Pangram poll failed: ${polled.status}`);
    const task = (await polled.json()) as PangramTask;

    if (task.stage === 'STAGE_FAILED') throw new Error('Pangram task failed');
    if (task.stage === 'STAGE_SUCCESS') {
      return {
        prediction: task.prediction_short ?? 'Human',
        fractionAi: task.fraction_ai ?? 0,
        fractionAiAssisted: task.fraction_ai_assisted ?? 0,
        fractionHuman: task.fraction_human ?? 0,
        headline: task.headline ?? '',
      };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Pangram timed out');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== '/classify' || request.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (!env.SCREENER_TOKEN || request.headers.get('x-screener-token') !== env.SCREENER_TOKEN) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > MAX_TEXT) return json({ error: 'invalid_text' }, 400);

    // Identical messages (spam is copy-pasted) are only paid for once.
    const cache = caches.default;
    const cacheKey = new Request(`https://cache.x-request-screener/classify/${await sha256(text)}`);
    const hit = await cache.match(cacheKey);
    if (hit) return json(await hit.json(), 200, { 'x-cache': 'hit' });

    try {
      const result = await classifyWithPangram(text, env);
      ctx.waitUntil(
        cache.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'cache-control': `max-age=${CACHE_TTL_S}` } })),
      );
      return json(result);
    } catch (error) {
      return json({ error: 'upstream_failed', detail: (error as Error).message }, 502);
    }
  },
} satisfies ExportedHandler<Env>;
