# Creator Copilot AI Public Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep work in the `codex/creator-copilot-ai-v0.2` worktree and use test-driven development for every behavior change.

**Goal:** Ship Creator Copilot v0.2.0 as a public Chrome extension with invite-gated, quota-limited AI analysis through a secure Cloudflare Worker, then publish the verified artifact to GitHub and submit the same ZIP to the Chrome Web Store.

**Architecture:** Extend the existing npm workspace with a Cloudflare Worker and versioned shared API schemas. The extension continues to extract and preview minimal public X context locally. A confirmed request goes to the Worker using a revocable installation token. The Worker validates the request, atomically charges quota, calls a provider through a testable adapter, validates structured output, and returns it without persisting page text or drafts. D1 stores only hashed invites, hashed sessions, revocation state, and usage counters.

**Tech Stack:** TypeScript 7, React 19, Vite, Manifest V3, Vitest, Zod, Cloudflare Workers, D1, Wrangler, Web Crypto, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-09-24-creator-copilot-ai-public-beta-design.md`

## Global constraints

- Never use, commit, echo, log, or bundle the OpenAI key previously pasted into chat.
- The production OpenAI key must be newly created, restricted, and transferred directly into a Worker secret.
- Do not add X API access, private-message access, autonomous posting, subscriptions, or general computer control.
- Keep Chrome permissions to `sidePanel`, `storage`, `activeTab`, and `scripting`; add only the exact API URL to `host_permissions`/connect access when required.
- Raw page context and generated drafts remain out of D1 and Worker logs.
- Local deterministic recommendations remain available when the installation is not activated.
- Every remote analysis requires extraction followed by a distinct confirmation click.
- Never retry a provider call automatically.
- Use stable public error codes and do not expose upstream response bodies.

---

### Task 1: Add versioned shared API contracts

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/models.ts`
- Create: `packages/shared/src/api.ts`
- Create: `packages/shared/src/api.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `analysisRequestSchema`, `analysisResultSchema`, `inviteRedemptionSchema`, `ApiErrorCode`, `AnalysisRequest`, `AnalysisResult`, and `API_SCHEMA_VERSION`.
- Consumes the existing `CreatorProfile`, `PageContext`, `Recommendation`, and `Experiment` domain types.

- [ ] **Step 1: Write failing schema tests**

Cover a valid analysis request/result plus rejection of unknown fields, unsupported versions, overlong text, unsafe URL shapes, excessive arrays, and malformed metrics. Assert that only the creator-profile fields needed for one analysis are present.

```ts
expect(() => analysisRequestSchema.parse(validRequest)).not.toThrow();
expect(() => analysisRequestSchema.parse({ ...validRequest, secret: 'nope' })).toThrow();
expect(() => analysisRequestSchema.parse(oversizedRequest)).toThrow();
```

- [ ] **Step 2: Run `npm.cmd test --workspace @creator-copilot/shared -- api.test.ts`**

Expected: FAIL because `api.ts` does not exist.

- [ ] **Step 3: Add Zod and implement strict, bounded schemas**

Use `.strict()` objects and explicit maximums. Keep `AnalysisResult` compatible with the existing recommendation cards while adding `summary`, `evidence`, `experiment`, `notices`, and quota metadata.

- [ ] **Step 4: Export the contracts and run shared tests/typecheck**

Run:

```powershell
npm.cmd test --workspace @creator-copilot/shared
npm.cmd run typecheck --workspace @creator-copilot/shared
```

Expected: all shared tests and type checking pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/shared package-lock.json
git commit -m "feat: define AI analysis API contracts"
```

### Task 2: Scaffold the Worker and fail-closed HTTP boundary

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.jsonc`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/errors.ts`
- Create: `apps/api/src/router.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/router.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `Env`, `createRouter(dependencies)`, `jsonResponse`, and a Worker `fetch` handler.
- Consumes shared API schemas but does not call OpenAI yet.

- [ ] **Step 1: Write failing route tests**

Test `GET /v1/health`, `404`, method rejection, content-type enforcement, 24 KiB body limit, production-origin allowlist, preflight behavior, and stable error envelopes.

```ts
expect(await json(request('/v1/health'))).toEqual({
  ok: true,
  schemaVersion: 1,
});
expect(response.headers.get('access-control-allow-origin')).toBe(PRODUCTION_EXTENSION_ORIGIN);
```

- [ ] **Step 2: Run API route tests**

Expected: FAIL because the API workspace and router do not exist.

- [ ] **Step 3: Add the API workspace and implement the minimal router**

Use dependency injection for clock, random bytes, database, logger, and analysis provider. Do not log request bodies or authorization headers. The health response must not reveal bindings or configuration.

- [ ] **Step 4: Add dev/production Wrangler environments with no secrets or real IDs committed**

Document binding names only: `DB`, `OPENAI_API_KEY`, `SESSION_SIGNING_SECRET`, `NETWORK_HASH_SALT`, `OPENAI_MODEL`, `ALLOWED_EXTENSION_ORIGIN`, and `DAILY_ANALYSIS_LIMIT`.

- [ ] **Step 5: Run API tests, root tests, and typecheck**

Expected: all checks pass without Cloudflare credentials.

- [ ] **Step 6: Commit**

```powershell
git add apps/api package.json package-lock.json tsconfig.base.json
git commit -m "feat: scaffold fail-closed worker API"
```

### Task 3: Implement invite redemption and revocable sessions

**Files:**
- Create: `apps/api/migrations/0001_auth.sql`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/crypto.ts`
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/auth.test.ts`
- Modify: `apps/api/src/router.ts`
- Modify: `apps/api/src/router.test.ts`
- Create: `apps/api/scripts/create-invites.mjs`
- Create: `apps/api/scripts/create-invites.test.mjs`

**Interfaces:**
- Produces one-time invite redemption, `requireSession`, `revokeSession`, and an offline invite-generation command.
- Consumes the D1 binding and Web Crypto.

- [ ] **Step 1: Write failing auth and route tests**

Cover secure random invite generation, hash-only storage, one-time transactional redemption, invalid invite indistinguishability, token expiry, installation binding, token tampering, session revocation, and log redaction.

- [ ] **Step 2: Run focused auth tests**

Expected: FAIL because migration and auth modules do not exist.

- [ ] **Step 3: Add D1 auth schema**

Create `invites` and `sessions` tables with unique hashes, redemption/revocation timestamps, expiry, and indexes. Never store raw invite or bearer token values.

- [ ] **Step 4: Implement token creation and verification**

Use a random token secret plus an HMAC-authenticated session identifier. Store only a SHA-256 token hash. Compare derived values without branching on secret contents.

- [ ] **Step 5: Add `/v1/invites/redeem` and `DELETE /v1/session`**

Redemption must mark the invite and insert the session atomically. Revocation must require the active bearer token.

- [ ] **Step 6: Implement the local invite generator**

The script prints newly generated invite codes only to the operator console and writes only hashes/labels to an import SQL file. Add that generated path to `.gitignore`.

- [ ] **Step 7: Run auth, API, root tests, and typecheck**

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add .gitignore apps/api
git commit -m "feat: add invite-gated installation sessions"
```

### Task 4: Add atomic quotas and the deterministic provider

**Files:**
- Create: `apps/api/migrations/0002_usage.sql`
- Create: `apps/api/src/quota.ts`
- Create: `apps/api/src/quota.test.ts`
- Create: `apps/api/src/providers/types.ts`
- Create: `apps/api/src/providers/fake.ts`
- Create: `apps/api/src/providers/fake.test.ts`
- Create: `apps/api/src/analysis.ts`
- Create: `apps/api/src/analysis.test.ts`
- Modify: `apps/api/src/router.ts`
- Modify: `apps/api/src/router.test.ts`

**Interfaces:**
- Produces `AnalysisProvider`, `FakeAnalysisProvider`, atomic `chargeAnalysis`, and authenticated `POST /v1/analyses`.
- Consumes shared schemas, authenticated sessions, D1, policy rules, and injected time/network hash inputs.

- [ ] **Step 1: Write failing quota and analysis tests**

Cover ten successful charges per UTC day, the eleventh rejection, concurrent increments, daily rollover, malformed input not consuming quota, a started provider call consuming quota, no automatic retry, and a privacy-preserving salted network hash.

- [ ] **Step 2: Run focused tests**

Expected: FAIL because quota and provider modules do not exist.

- [ ] **Step 3: Implement the usage migration and atomic charge**

Use one row per session/day and a single D1 upsert/returning operation. Store counts and token/cost estimates only, never context or drafts.

- [ ] **Step 4: Implement the provider interface and deterministic fake**

The fake must return the same valid `AnalysisResult` for the same sanitized input, allowing local end-to-end tests without an OpenAI key.

- [ ] **Step 5: Implement `/v1/analyses` with the fake provider**

Order: authenticate, bound body, parse schema, deterministic safety check, charge quota, call provider once, validate result, return stable response.

- [ ] **Step 6: Capture logs in tests and assert privacy**

Assert that post text, handles, URLs, bearer tokens, invite codes, and generated drafts do not appear.

- [ ] **Step 7: Run the entire suite and typecheck**

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add apps/api packages/shared
git commit -m "feat: enforce bounded AI analysis quotas"
```

### Task 5: Implement the OpenAI Responses provider

**Files:**
- Create: `apps/api/src/providers/openai.ts`
- Create: `apps/api/src/providers/openai.test.ts`
- Create: `apps/api/src/providers/prompt.ts`
- Create: `apps/api/src/providers/prompt.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `OpenAIAnalysisProvider` behind the existing `AnalysisProvider` contract.
- Consumes the official OpenAI SDK, `OPENAI_API_KEY`, configurable pinned `OPENAI_MODEL`, and strict `AnalysisResult` JSON schema.

- [ ] **Step 1: Recheck current official OpenAI Responses API and Structured Outputs documentation**

Confirm the SDK request shape at implementation time. Do not infer a current model alias from memory.

- [ ] **Step 2: Write failing provider tests using a fake OpenAI transport**

Assert developer instructions remain separate from untrusted page context, strict schema output is requested, one provider call occurs, request IDs are propagated, handles are not used as safety identifiers, malformed/refused/empty output fails closed, and upstream bodies are not exposed.

- [ ] **Step 3: Write prompt-contract tests**

Cover evidence-only explanations, uncertainty notices, creator boundaries, no false attribution claims, and refusal of threats, doxxing, debt coercion, account compromise, minors, or spending-boundary override tactics.

- [ ] **Step 4: Implement the OpenAI adapter**

Use the Responses API, strict structured output, an application request ID, a non-identifying stable safety identifier, bounded output, timeout through `AbortSignal`, and no automatic retry.

- [ ] **Step 5: Select fake versus OpenAI provider from validated environment configuration**

Local tests default to fake. Production must fail startup/config validation if the OpenAI secret, pinned model, or signing configuration is absent.

- [ ] **Step 6: Run provider tests, full tests, and typecheck**

Expected: all pass without a live key.

- [ ] **Step 7: Commit**

```powershell
git add apps/api package-lock.json
git commit -m "feat: add validated OpenAI analysis provider"
```

### Task 6: Add extension activation and API client state

**Files:**
- Create: `apps/extension/src/lib/apiClient.ts`
- Create: `apps/extension/src/lib/apiClient.test.ts`
- Create: `apps/extension/src/state/auth.ts`
- Create: `apps/extension/src/state/auth.test.ts`
- Modify: `apps/extension/src/state/defaults.ts`
- Modify: `apps/extension/src/state/reducer.ts`
- Modify: `apps/extension/src/state/reducer.test.ts`
- Modify: `apps/extension/src/state/store.ts`
- Modify: `apps/extension/src/state/store.test.ts`
- Modify: `apps/extension/src/App.tsx`

**Interfaces:**
- Produces `CreatorCopilotApiClient`, activation/session state, and reducer actions for activation, quota updates, expiry, revocation, and sign-out.
- Consumes shared request/result schemas and the configured production API URL.

- [ ] **Step 1: Write failing API-client tests**

Cover invite redemption, bearer handling, stable error mapping, timeout, no automatic retry, schema validation, quota metadata, and refusal to send when no valid session exists.

- [ ] **Step 2: Write failing state and persistence tests**

Assert raw page context remains unpersisted; invite code is never persisted; session token is cleared on sign-out/delete/expiry; creator settings and local recommendations survive ordinary auth failure.

- [ ] **Step 3: Implement the API client and auth state**

Generate the installation identifier locally with secure randomness. Keep API base URL in build configuration and validate it as HTTPS for production builds.

- [ ] **Step 4: Integrate state into `App` through injectable clients**

Preserve dependency injection so component tests do not use the network.

- [ ] **Step 5: Run extension tests and typecheck**

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/extension package-lock.json
git commit -m "feat: add extension activation and API client"
```

### Task 7: Build the activation and confirmed remote-analysis UI

**Files:**
- Create: `apps/extension/src/components/ActivationCard.tsx`
- Create: `apps/extension/src/components/ActivationCard.test.tsx`
- Modify: `apps/extension/src/components/AnalyzeView.tsx`
- Create: `apps/extension/src/components/AnalyzeView.test.tsx`
- Modify: `apps/extension/src/components/SettingsView.tsx`
- Modify: `apps/extension/src/App.tsx`
- Modify: `apps/extension/src/App.test.tsx`
- Modify: `apps/extension/src/styles.css`

**Interfaces:**
- Consumes activation state and `CreatorCopilotApiClient`.
- Produces activation, explicit transmission confirmation, quota, timeout, retry, expiry, offline fallback, and sign-out UI.

- [ ] **Step 1: Write failing interaction tests**

Cover public local mode, invite activation, hidden invite after submission, second confirmation copy, remote request only after confirmation, remaining quota, over-quota behavior, expired session, explicit retry, and local fallback.

- [ ] **Step 2: Run focused UI tests**

Expected: FAIL because the UI does not exist.

- [ ] **Step 3: Implement activation in Settings and Analyze**

Clearly distinguish local recommendations from AI analysis. Never imply that the extension is connected to X or that outputs prove causal revenue impact.

- [ ] **Step 4: Replace the local confirmation action with explicit local/AI choices**

The remote button must state that the displayed context will be sent to Creator Copilot's API and OpenAI. Cancel removes context from memory. Retry remains a separate click.

- [ ] **Step 5: Add accessible loading, status, and error styles**

Maintain keyboard focus, 44px targets, 4.5:1 contrast, narrow side-panel responsiveness, and `prefers-reduced-motion` behavior.

- [ ] **Step 6: Run UI tests, full tests, typecheck, and build**

Expected: all pass and production build succeeds.

- [ ] **Step 7: Commit**

```powershell
git add apps/extension
git commit -m "feat: connect confirmed analysis to AI backend"
```

### Task 8: Add public privacy, support, and store materials

**Files:**
- Create: `docs/privacy/privacy-policy.md`
- Create: `docs/privacy/support.md`
- Create: `docs/store/listing.md`
- Create: `docs/store/data-use.md`
- Create: `docs/store/submission-checklist.md`
- Create: `apps/api/src/publicPages.ts`
- Create: `apps/api/src/publicPages.test.ts`
- Modify: `apps/api/src/router.ts`
- Modify: `README.md`
- Modify: `docs/INSTALL.md`

**Interfaces:**
- Produces hosted `/privacy` and `/support` pages plus source-of-truth Chrome Web Store copy.
- Consumes only the behaviors already implemented and verified.

- [ ] **Step 1: Write failing public-page route tests**

Assert successful HTML responses, secure headers, accessible headings, contact method, last-updated date, and no analytics or remote scripts.

- [ ] **Step 2: Draft privacy and support copy from observed data flow**

Document extension permissions, explicit context preview, OpenAI and Cloudflare as processors, local versus server data, retention, deletion, security, contact, and limitations. Do not make legal-compliance claims that have not been reviewed.

- [ ] **Step 3: Implement static Worker routes and headers**

Serve from checked-in copy/templates so public pages and store answers stay reviewable.

- [ ] **Step 4: Create the listing package**

Include name, short and long description, single-purpose statement, permission justifications, remote-code declaration, privacy answers, support URL, and screenshot requirements.

- [ ] **Step 5: Run public-page tests and full checks**

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add docs README.md apps/api
git commit -m "docs: add privacy and store submission materials"
```

### Task 9: Harden and package v0.2.0

**Files:**
- Modify: `package.json`
- Modify: `apps/extension/package.json`
- Modify: `apps/extension/manifest.config.ts`
- Modify: `scripts/verify-package.mjs`
- Create: `scripts/verify-package.test.mjs`
- Modify: `package-lock.json`
- Create: `docs/RELEASE-v0.2.0.md`

**Interfaces:**
- Produces the exact audited `release/creator-copilot-extension.zip` intended for both GitHub and the Chrome Web Store.

- [ ] **Step 1: Write failing package-verifier tests**

Use intentionally unsafe fixture archives to prove rejection of secrets, `.dev.vars`, source maps, test files, localhost/dev URLs, unexpected hosts, broad permissions, and mismatched versions.

- [ ] **Step 2: Increase package and manifest versions to `0.2.0`**

- [ ] **Step 3: Harden `verify-package.mjs`**

Require the exact production API origin and approved manifest permissions. Scan text assets for secret prefixes and development endpoints without printing matched secret contents.

- [ ] **Step 4: Build, package, and inspect the ZIP**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run package
```

Expected: all pass; the ZIP contains no secret, development configuration, source map, test, fixture, or unexpected permission.

- [ ] **Step 5: Record artifact hash and contents**

Write the SHA-256 hash, version, approved permissions, API origin, commands, and results to `docs/RELEASE-v0.2.0.md`.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json apps/extension scripts docs/RELEASE-v0.2.0.md
git commit -m "build: prepare verified creator copilot v0.2.0"
```

### Task 10: Deploy bounded production infrastructure

**Files:**
- Modify: `apps/api/wrangler.jsonc` with created resource identifiers
- Create: `docs/OPERATIONS.md`
- Modify: `docs/RELEASE-v0.2.0.md`

**External state:** Cloudflare Worker/D1 resources, Worker secrets, and OpenAI project key. Never place secret values in files or command output.

- [ ] **Step 1: Verify Cloudflare account and create separate development/production D1 databases**

Record only resource names and non-secret IDs. Apply migrations to development first.

- [ ] **Step 2: Deploy with the fake provider and run smoke tests**

Verify health, origin rejection, invalid invite behavior, and public privacy/support routes.

- [ ] **Step 3: Create a fresh restricted OpenAI project key**

Create it only when the secret can be transferred directly to `wrangler secret put OPENAI_API_KEY`. Do not paste it into chat, shell history, files, Git, or logs. Do not use the previously exposed key.

- [ ] **Step 4: Configure signing/network secrets and production limits**

Generate each secret locally with cryptographically secure randomness and stream it directly to Wrangler's secret input. Confirm OpenAI project spend limits and alerts remain bounded.

- [ ] **Step 5: Run a bounded live-provider test**

Use synthetic public context. Verify structured output, one quota charge, request ID capture, and absence of raw context in D1/logs.

- [ ] **Step 6: Apply production migrations and deploy production**

Generate a small first batch of creator invites. Keep plaintext codes only in a temporary operator handoff and never commit them.

- [ ] **Step 7: Write the operations runbook**

Document session revocation, invite generation, quota change, provider disable switch, log inspection, spend response, rollback, and secret rotation.

- [ ] **Step 8: Rebuild against the final production API origin and rerun Task 9 verification**

- [ ] **Step 9: Commit non-secret deployment configuration and evidence**

```powershell
git add apps/api/wrangler.jsonc docs/OPERATIONS.md docs/RELEASE-v0.2.0.md
git commit -m "ops: document bounded AI production deployment"
```

### Task 11: Review, merge, release, and submit

**Files:**
- Modify only if review finds defects.
- Update: `docs/RELEASE-v0.2.0.md`
- Update: `docs/store/submission-checklist.md`

**External state:** GitHub branch/PR/release and Chrome Web Store draft/submission.

- [ ] **Step 1: Perform a security-focused self-review**

Review the complete diff for credentials, permission expansion, logging, CORS, session handling, atomic quota behavior, prompt injection boundaries, and store-disclosure mismatch.

- [ ] **Step 2: Run final verification from a clean install**

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run package
git diff --check origin/main...HEAD
git status --short
```

Install the ZIP in a clean Chrome profile and verify activation, preview, remote confirmation, analysis, quota, copy, sign-out, revoked session, local fallback, privacy page, and support page.

- [ ] **Step 3: Request code review and resolve findings**

Do not merge with unresolved correctness, security, privacy, or release-blocking findings.

- [ ] **Step 4: Push the branch, open a pull request, and attach it to the task**

Include test evidence, privacy behavior, deployment URL, artifact SHA-256, screenshots, and known limitations.

- [ ] **Step 5: Merge only after required checks pass**

Confirm `origin/main` contains the merge and the branch working tree is clean.

- [ ] **Step 6: Create GitHub release `v0.2.0`**

Upload the exact verified ZIP and confirm its downloaded hash matches `docs/RELEASE-v0.2.0.md`.

- [ ] **Step 7: Upload the identical ZIP and listing assets to the Chrome Web Store**

Complete disclosures from checked-in store documents. Verify the item ID, then lock the Worker production origin allowlist to that `chrome-extension://` origin and rerun the production smoke test.

- [ ] **Step 8: Submit the store listing for review**

Record the submission time and dashboard status. Do not claim publication until Google reports it published.

- [ ] **Step 9: Handle the exposed historical key**

After the new Worker key is verified, request explicit action-time approval to revoke the previously exposed key if that revocation has not already been authorized.

## Completion evidence

- Test counts and command output from the final clean run.
- Cloudflare production URL and health result.
- D1 migration state and redacted invite/session/quota checks.
- OpenAI live request ID and bounded usage result, without request content or credentials.
- ZIP SHA-256 and verified file list.
- GitHub release URL.
- Chrome Web Store item ID and current review/publication status.
- Privacy and support URLs.
- Confirmation that no raw page context or secrets appear in source, artifact, D1, or logs.
