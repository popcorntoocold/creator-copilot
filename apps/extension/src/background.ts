import type { PangramResult } from './detector';

const API_URL = import.meta.env.VITE_SCREENER_API_URL;
const TOKEN = import.meta.env.VITE_SCREENER_TOKEN;

export type PangramResponse = { ok: true; result: PangramResult } | { ok: false; reason: string };

async function classify(text: string): Promise<PangramResponse> {
  if (!API_URL || !TOKEN) return { ok: false, reason: 'not_configured' };
  try {
    const response = await fetch(`${API_URL.replace(/\/+$/, '')}/classify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-screener-token': TOKEN },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    return { ok: true, result: (await response.json()) as PangramResult };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'pangram') return false;
  const text = 'text' in message && typeof message.text === 'string' ? message.text : '';
  void classify(text).then(sendResponse);
  return true;
});
