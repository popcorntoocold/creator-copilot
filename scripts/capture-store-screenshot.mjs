import { writeFileSync } from 'node:fs';

const targetUrl = 'http://127.0.0.1:4173/';
const outputPath = new URL('../docs/store/assets/screenshot-today-1280x800.png', import.meta.url);
const state = {
  profile: {
    handle: '@ateliernova',
    displayName: 'Atelier Nova',
    voice: 'Warm, precise, quietly confident',
    allowedTopics: 'creative rituals, personal style, behind the scenes',
    prohibitedTopics: 'private details, debt, threats, coercion',
    contentFrequency: 'Daily',
    preferredFormats: ['Post', 'Reply'],
    monetizationDestination: 'my verified creator page',
    weeklyGoal: 'Start ten useful public conversations',
    consentAccepted: true,
  },
  recommendations: [
    {
      id: 'store-hook',
      kind: 'hook',
      title: 'Lead with the recognizable tension',
      rationale: 'The source post contrasts polished results with the quiet routine behind them.',
      draft: 'The polished part is visible. The small ritual that makes it repeatable usually is not.',
      copyable: true,
      requiresReview: true,
      status: 'ready',
    },
    {
      id: 'store-reply',
      kind: 'reply',
      title: 'Ask for one concrete detail',
      rationale: 'A specific question gives readers an easy, useful way to join the conversation.',
      draft: 'What is the one part of your routine you protect even on the busiest week?',
      copyable: true,
      requiresReview: true,
      status: 'ready',
    },
    {
      id: 'store-follow-up',
      kind: 'follow_up',
      title: 'Turn the response into a follow-up',
      rationale: 'Use the strongest public replies as evidence for the next post.',
      draft: 'Three routines people keep returning to—and why the simplest one won.',
      copyable: true,
      requiresReview: true,
      status: 'ready',
    },
  ],
  auth: {
    status: 'active',
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    token: 'store-screenshot-placeholder',
    expiresAt: '2026-10-25T00:00:00.000Z',
    quota: { remaining: 9, limit: 10, resetsAt: '2026-09-26T00:00:00.000Z' },
  },
};

const target = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(targetUrl)}`, {
  method: 'PUT',
}).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

function call(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((resolve) => setTimeout(resolve, 500));
await call('Runtime.evaluate', {
  expression: `localStorage.setItem('creatorCopilotState', ${JSON.stringify(JSON.stringify(state))}); location.reload();`,
});
await new Promise((resolve) => setTimeout(resolve, 1200));
await call('Runtime.evaluate', {
  expression: 'document.fonts.ready',
  awaitPromise: true,
});
const screenshot = await call('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
socket.close();
process.stdout.write(`Saved ${outputPath.pathname}\n`);
