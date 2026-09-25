# Creator Copilot AI Public Beta Design

## Status

Approved direction on September 24, 2026. This document refines the existing Creator Copilot extension design for the v0.2 public-download and invite-gated AI milestone.

## Objective

Turn the released local MVP into a publicly downloadable Chrome extension whose AI analysis is useful to invited creator testers without exposing the OpenAI credential or creating an uncontrolled usage bill.

The extension remains creator-controlled. It analyzes only a minimal preview of the visible public X page after an explicit confirmation and returns drafts and recommendations for the creator to review. It does not post, message, follow, purchase, or change account settings.

## Product decision

The extension itself will be publicly installable. Deterministic local features remain available to every installer. AI analysis requires a single-use pilot invite code that is exchanged for a revocable installation session.

This is preferred over:

- embedding or accepting an OpenAI key in the extension, which exposes secrets in client-side code;
- unauthenticated public AI access, which permits trivial credit abuse;
- building subscriptions, OAuth, and a full account system before the pilot establishes retention and willingness to pay.

The result is a low-friction public beta with bounded financial risk. A later milestone can replace invite codes with accounts and billing without changing the analysis contract.

## Scope

### Included in v0.2

- Cloudflare Worker API in `apps/api`;
- D1 tables for hashed invites, installation sessions, revocations, and daily usage counters;
- server-side OpenAI Responses API adapter;
- deterministic fake provider for automated tests and local development;
- strict request and response schemas in `packages/shared`;
- invite redemption and revocable installation sessions;
- per-session and coarse per-IP rate limits;
- extension integration for activation, analysis, loading, quota, retry, and failure states;
- local persistence of generated recommendations and creator settings;
- hosted privacy policy and support page;
- Chrome Web Store-ready ZIP, screenshots, descriptions, permission explanations, and data-use answers;
- a GitHub v0.2.0 release after verification.

### Explicitly deferred

- X API access or ownership verification;
- private-message reading;
- autonomous posting or messaging;
- persistent `x.com` host access;
- subscriptions, payment processing, or revenue sharing;
- multi-user agency dashboards;
- media upload or image understanding;
- general computer-use control;
- integrations with creator platforms;
- server-side storage of raw page context or creator drafts.

## Repository structure

```text
creator-copilot/
  apps/
    extension/     Existing Manifest V3 React sidebar
    api/           Cloudflare Worker, D1 migrations, provider adapters
  packages/
    shared/        Versioned schemas, policy checks, API contracts
  docs/
    privacy/       Source copy for privacy and support pages
    store/         Chrome Web Store listing copy and submission checklist
```

## User experience

### First install

1. The creator installs the extension and completes the existing local onboarding.
2. The sidebar explains that local planning features work immediately and AI analysis requires a beta invite.
3. The creator enters an invite code.
4. The extension exchanges it for an installation session and never stores the invite code again.
5. Settings displays activation state, remaining daily analyses, privacy controls, and a sign-out action.

### AI analysis

1. The creator opens a supported public X profile or post.
2. The creator presses **Analyze this page**.
3. Existing extraction checks reject unsupported routes and direct-message routes before reading the page.
4. The extension displays the exact sanitized context that would be sent.
5. The creator presses **Send for AI analysis**.
6. The API authenticates the session, validates size and shape, applies rate limits and policy checks, and calls the provider.
7. The API validates the structured provider output and returns it without storing the raw context.
8. The extension stores the structured recommendation locally and lets the creator copy, edit, dismiss, or complete it.

The extension never silently retries an AI request because a retry may consume quota. A retry always requires another explicit click.

## API contract

### `GET /v1/health`

Returns service availability and schema version. It exposes no credentials or database details.

### `POST /v1/invites/redeem`

Accepts an invite code and a randomly generated installation identifier. A valid unused invite creates a session and marks the invite redeemed in one database transaction.

The response contains:

- a signed opaque session token;
- its expiration time;
- the current daily quota;
- the API schema version.

Invite codes are generated with cryptographically secure randomness and stored only as hashes. Logs never contain raw invite codes or session tokens.

### `POST /v1/analyses`

Accepts:

- API schema version;
- request identifier generated by the extension;
- creator profile fields needed for this analysis;
- confirmed `PageContext`;
- requested analysis mode.

The body is limited to 24 KiB. Unknown fields are rejected. The endpoint returns one `AnalysisResult` containing:

- a concise explanation of why the visible content may be working or underperforming;
- observable evidence from the supplied context;
- three ranked, creator-controlled recommendations;
- up to three editable draft variants;
- one measurable experiment;
- any policy or uncertainty notices;
- remaining daily quota.

Provider output uses strict JSON-schema structured output and is validated again against the shared runtime schema before returning to the extension. Malformed output is discarded.

### `DELETE /v1/session`

Revokes the current installation session. Local creator data is removed only when the creator separately chooses the existing local delete/reset control.

## Authentication and abuse controls

- A one-time invite may activate one installation.
- The API stores a hash of each session token, never the bearer token itself.
- Tokens expire after 30 days and are revocable immediately.
- The initial allowance is 10 successful analyses per installation per UTC day.
- Failed schema validation and unsupported-page checks do not consume analysis quota.
- Provider calls that begin processing consume quota to prevent retry abuse.
- Requests are also throttled by session and a privacy-preserving hash of a coarse network identifier.
- The Worker accepts production extension requests only from the configured Chrome extension origin after the Web Store ID exists.
- Development origins are explicit environment configuration and are never enabled in production.
- Error responses reveal neither invite validity details nor upstream provider bodies.

These controls bound casual abuse for a pilot. They are not a substitute for real user accounts before unrestricted paid access.

## OpenAI integration

The Worker uses the Responses API through a small provider interface. Production model selection is an environment variable so a pinned model can be evaluated and changed without repackaging the extension.

The request uses:

- fixed developer instructions owned by the application;
- the confirmed, sanitized context as untrusted user content;
- a strict JSON schema matching `AnalysisResult`;
- a stable per-installation safety identifier that contains no X handle or email;
- an application-generated client request ID for troubleshooting.

The OpenAI credential exists only as an encrypted Cloudflare Worker secret. It is never committed, returned by an API endpoint, placed in an extension bundle, or stored in Chrome storage. The credential previously pasted into chat is considered exposed and will not be used for deployment. Deployment requires a newly created restricted project key transferred directly into the Worker secret store, followed by revocation of the exposed key when the owner approves that action.

## Privacy and retention

The preview is the consent boundary. Nothing is transmitted until the creator confirms it.

The backend stores only:

- hashed invite and session records;
- revocation state;
- daily request counts and token-cost totals;
- timestamps, status classes, latency, and generated request IDs;
- aggregate product events that contain no post text, handle, draft, or raw model output.

The backend does not store page text, visible replies, creator voice examples, generated drafts, X handles, URLs containing post identifiers, or raw OpenAI response bodies. Those remain local to the extension. Operational logs redact authorization headers and request bodies.

The public privacy policy describes the exact data sent, purpose, subprocessors, retention, deletion behavior, permissions, and contact method. Store disclosure answers must match the implemented behavior.

## Safety behavior

Existing shared policy rules remain authoritative. The model may help a consenting adult creator improve public content and monetization offers, but it must not generate threats, blackmail, doxxing, non-consensual exposure, debt coercion, account compromise, content involving minors, or tactics designed to override a person's stated spending boundary.

Model instructions are defense in depth. Deterministic input checks, output validation, and visible creator review remain required. AI output is labeled as a suggestion, not verified performance attribution.

## Extension changes

- Replace the hard-coded recommendation path with a provider interface that supports local and remote providers.
- Keep the local provider as an offline fallback and for tests.
- Add activation and session state without persisting raw page context.
- Add a second explicit confirmation button before remote transmission.
- Show daily quota and whether a failure consumed quota.
- Preserve the last sanitized request in memory only long enough for an explicit retry.
- Keep permissions limited to `sidePanel`, `storage`, `activeTab`, and `scripting`.
- Add the API origin to extension connect permissions; do not add `<all_urls>`.

## Deployment and distribution

### Backend

- Separate Worker environments for development and production.
- Separate D1 databases and signing secrets.
- Database migrations run before code deployment.
- Production deployment fails if the OpenAI secret, session-signing secret, production extension ID, or model configuration is missing.
- Spend protection includes OpenAI project limits, application quotas, and Cloudflare alerts.

### Extension

- Version increases to `0.2.0`.
- The packaging verifier rejects source maps, environment files, private keys, `.dev.vars`, broad host permissions, and non-production endpoints.
- The GitHub release remains available for technical users.
- The identical verified ZIP is uploaded to the Chrome Web Store.

Chrome Web Store publication depends on Google's review and cannot be guaranteed immediately. The milestone is complete when the submission is accepted or, if review is pending, when the exact verified build is submitted and the review status is documented.

## Testing strategy

### Shared package

- request and response schema acceptance and rejection;
- payload-size and field redaction behavior;
- policy boundaries;
- version compatibility.

### Worker unit and integration tests

- invite redemption is single-use and transactional;
- bearer tokens are hashed, expiring, and revocable;
- quota accounting is atomic under concurrent requests;
- malformed and oversized requests never call the provider;
- fake provider output passes the same validation as production output;
- malformed provider output is discarded;
- request and authorization data do not appear in captured logs;
- CORS and origin rules fail closed;
- upstream timeout and rate-limit responses map to stable public errors.

### Extension tests

- remote calls require activation and the second confirmation;
- unsupported pages and DM routes never call the API;
- raw context is absent from persisted Chrome storage;
- token expiry, quota exhaustion, offline fallback, and explicit retry states;
- sign-out clears only authentication state;
- packaged manifest contains only approved permissions and production endpoints.

### Release verification

- all unit, integration, typecheck, build, and package checks pass;
- a clean Chrome profile completes install, activation, analysis, copy, sign-out, and reactivation;
- inspection of the ZIP finds no secret or development configuration;
- a real production analysis succeeds through the Worker;
- a revoked session and reused invite both fail;
- privacy-policy and Web Store answers match observed network traffic.

## Rollout

1. Implement and verify locally with the fake provider.
2. Deploy the development Worker and D1 database with synthetic data.
3. Add a fresh restricted OpenAI key directly to the development secret store and run bounded live tests.
4. Deploy production infrastructure and generate the initial creator invites.
5. Package and publish GitHub v0.2.0.
6. Upload the same artifact and disclosure materials to the Chrome Web Store.
7. Invite the initial creator cohort and monitor activation, retained usage, errors, and cost per active creator.

## Success criteria

The v0.2 milestone is accepted when:

- the extension is publicly downloadable from GitHub and submitted to the Chrome Web Store;
- an invited creator can activate and receive a useful structured analysis without handling an API key;
- non-invited and over-quota requests cannot create OpenAI spend;
- no secret is present in source control, the packaged extension, browser storage, or responses;
- no raw page context appears in D1 or application logs;
- the clean-profile release flow passes;
- the owner can revoke a session and disable AI access without shipping a new extension.
