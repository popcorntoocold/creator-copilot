# Creator Copilot operations runbook

This runbook covers the invite-gated AI beta. Run commands from `apps/api` unless noted. Never paste secrets, invite codes, or session tokens into chat, source control, issue trackers, or command arguments.

## Production inventory

- Worker: `creator-copilot-api`
- URL: `https://creator-copilot-api.popcorntoohot.workers.dev`
- Production D1: `creator-copilot-production`
- Development D1: `creator-copilot-dev`
- Model: `gpt-6-luna`
- Session quota: 10 analyses per UTC day
- Coarse network ceiling: 100 analyses per UTC day

The checked-in D1 UUIDs are resource identifiers, not credentials. `OPENAI_API_KEY`, `SESSION_SIGNING_SECRET`, and `NETWORK_HASH_SALT` are Cloudflare secrets and must never be written to a file.

## Health and public pages

```powershell
Invoke-RestMethod https://creator-copilot-api.popcorntoohot.workers.dev/v1/health
Invoke-WebRequest https://creator-copilot-api.popcorntoohot.workers.dev/privacy
Invoke-WebRequest https://creator-copilot-api.popcorntoohot.workers.dev/support
```

Expected: health returns `ok: true` and schema version 1; both public pages return 200.

## Generate invites

Generate only the batch needed. The script writes a hash-only SQL import and prints the plaintext codes once. Redirect the JSON result directly to an access-controlled operator handoff; do not commit it.

```powershell
node scripts/create-invites.mjs 5 .generated/pilot-invites.sql
npx.cmd wrangler d1 execute creator-copilot-production --remote --env production --file .generated/pilot-invites.sql
```

Delete the generated SQL after a successful import. It contains hashes rather than plaintext codes, but it is an operational artifact and should not accumulate.

## Revoke a session

Identify the session from a non-secret internal session ID or installation ID. Never request or log its bearer token.

```sql
SELECT id, installation_id, created_at, expires_at, revoked_at
FROM sessions
WHERE installation_id = ?;

UPDATE sessions
SET revoked_at = datetime('now')
WHERE id = ? AND revoked_at IS NULL;
```

Execute parameterized operational SQL through an approved admin workflow. The extension's **Sign out of AI** control also revokes its current session through `DELETE /v1/session`.

## Change quotas

Edit `DAILY_ANALYSIS_LIMIT` and `NETWORK_DAILY_LIMIT` in `wrangler.jsonc`, keeping the network limit greater than or equal to the session limit. Run tests, deploy, then verify `/v1/health` and a bounded invited request. Configuration validation accepts session limits from 1 through 100 and network limits up to 10,000.

## Disable provider spending

For an immediate provider stop, set the production `PROVIDER` variable to `fake`, deploy, and verify health. Existing local features continue to work and invited requests return deterministic recommendations without OpenAI spend. Restore `openai` only after the incident is understood.

## Logs and usage

```powershell
npx.cmd wrangler tail creator-copilot-api --env production
npx.cmd wrangler d1 execute creator-copilot-production --remote --env production --command "SELECT day, SUM(count) AS analyses, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM daily_usage GROUP BY day ORDER BY day DESC LIMIT 14;"
```

Logs must not contain authorization headers, invite codes, request bodies, public-page context, profile text, or generated drafts. D1 stores only hashes, pseudonymous identifiers, timestamps, revocation state, and aggregate usage counters.

## Spend response

If usage or spend is unexpected:

1. Switch production to the fake provider and deploy.
2. Inspect aggregate D1 counters and OpenAI project usage without copying request content.
3. Revoke suspicious sessions or reduce quotas.
4. Rotate the OpenAI key if compromise is possible.
5. Restore the live provider only after the cause and new bound are verified.

Keep OpenAI project spend limits and alerts enabled. A Cloudflare quota is not a substitute for an OpenAI project budget.

## Secret rotation

Create a restricted OpenAI project key with only model-request permission and a short expiry. At an interactive terminal, stream or paste it directly into:

```powershell
npx.cmd wrangler secret put OPENAI_API_KEY --env production
```

Deploy, run one synthetic invited request, verify its token counters, and only then revoke the prior key. Rotate signing and network-hash secrets through the corresponding `wrangler secret put` commands. Rotating `SESSION_SIGNING_SECRET` invalidates every existing AI session; communicate that impact before doing it.

## Rollback

```powershell
npx.cmd wrangler deployments list --env production
npx.cmd wrangler rollback --env production
```

After rollback, verify health, public pages, origin rejection, and one bounded synthetic request. Database migrations are not reverted automatically; prefer forward-compatible migrations and a corrective migration.

## Release checklist

Before each extension release:

1. Run the clean verification commands in `docs/RELEASE-v0.2.0.md`.
2. Upload the exact verified ZIP to GitHub and the Chrome Web Store.
3. Record the Web Store item ID.
4. Replace the temporary production extension origin with that exact `chrome-extension://<item-id>` origin and deploy.
5. Run health, hostile-origin, activation, analysis, quota, sign-out, and revoked-session checks.
