# X Request Screener

A Chrome extension that overlays badges on your X (Twitter) message requests, flagging messages that look **AI-written** and senders that look like **spam accounts**. No sidebar, no popup — badges appear directly on the DM list and inside opened threads, plus a small counter in the bottom-left corner.

- **Likely / Maybe AI** — stock outreach openers ("I hope this message finds you well", "I came across your profile"), LLM vocabulary, generic flattery, templated pitches, em-dash-heavy or letter-formatted text.
- **Likely / Maybe spam** — crypto/investment pitches, pushes to Telegram/WhatsApp, promotion services, romance bait, fake "support" notices, links, bare "hi" openers, digit-string handles, bait words in display names.

Hover a badge to see the score and every signal that fired. The spam check and the first-pass AI check run locally with heuristics in `apps/extension/src/detector.ts`.

When the backend is configured, messages of 12+ words in an opened thread are also sent to [Pangram](https://www.pangram.com) through a Cloudflare Worker (`apps/worker`), and Pangram's verdict replaces the heuristic AI verdict. The worker holds the Pangram key, requires a shared token, and caches results by message hash for 30 days so copy-pasted spam is only paid for once.

## Install

Requires Chrome 114+ and Node.js 22.

```sh
npm install
npm run package
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `apps/extension/dist`. Then open `x.com/messages/requests`.

## Backend (Pangram via Cloudflare Worker)

```sh
cd apps/worker
npx wrangler login
npx wrangler secret put PANGRAM_API_KEY   # from pangram.com
npx wrangler secret put SCREENER_TOKEN    # any random string, e.g. `openssl rand -hex 24`
npx wrangler deploy                       # prints https://x-request-screener.<subdomain>.workers.dev
```

Then copy `apps/extension/.env.example` to `apps/extension/.env`, fill in the worker URL and token, and run `npm run package` again. Without `.env`, the extension runs heuristics only.

Local dev: put `PANGRAM_API_KEY` and `SCREENER_TOKEN` in `apps/worker/.dev.vars` and run `npm run dev -w apps/worker`.

## Development

```sh
npm test
npm run typecheck
npm run package   # builds, zips to release/, and verifies the manifest
```

## Tuning

Rules and weights live in `apps/extension/src/detector.ts`. A category scores 25+ for "Maybe" and 50+ for "Likely". If X changes its DOM, update the selectors at the top of `apps/extension/src/content.ts`.
