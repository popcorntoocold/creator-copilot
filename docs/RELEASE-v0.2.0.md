# Creator Copilot v0.2.0 release evidence

Status: release candidate; production deployment and Chrome Web Store submission are not yet complete.

## Artifact

- File: `release/creator-copilot-extension.zip`
- Version: `0.2.0`
- SHA-256: `2AEC0DC77ABB26A4501872E8DA9D90FD35227277A078722F97267C6A61EFDE17`
- Files: 22
- Production API origin: `https://creator-copilot-api.popcorntoohot.workers.dev`

The ZIP is generated from `apps/extension/dist` and is intentionally ignored by Git. Upload this exact file to the GitHub release and Chrome Web Store after the final verification run.

## Approved Chrome access

- Permissions: `activeTab`, `scripting`, `sidePanel`, `storage`
- Host permission: `https://creator-copilot-api.popcorntoohot.workers.dev/*`
- No `<all_urls>`, cookies, history, identity, payment, or persistent X host permission

## Verification completed September 24, 2026

Commands:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run package
```

Results:

- 99 tests passed: API 39, extension 35, shared 18, package policy 7.
- All three TypeScript workspace checks passed.
- Vite production build passed.
- Package verifier passed with 22 files, four approved permissions, four required PNG icon sizes, and one production API host.
- The verifier rejects source maps, tests, fixtures, environment files, `.dev.vars`, secret-shaped values, localhost/development URLs, unexpected remote hosts, broad permissions, and version mismatches.

## ZIP contents

```text
assets/background.ts-DZtjI47J.js
assets/cormorant-garamond-latin-600-normal-2CBVLo0M.woff
assets/cormorant-garamond-latin-600-normal-Co1r35X9.woff2
assets/cormorant-garamond-latin-700-normal-DajfzrDU.woff2
assets/cormorant-garamond-latin-700-normal-O25Qpphb.woff
assets/index-DHc7Qu-Z.css
assets/index.html-e8umQ_L9.js
assets/manrope-latin-400-normal-8tf8FM3T.woff
assets/manrope-latin-400-normal-PaqtzbVb.woff2
assets/manrope-latin-500-normal-BYYD-dBL.woff2
assets/manrope-latin-500-normal-DMZssgOp.woff
assets/manrope-latin-600-normal-4f0koTD-.woff2
assets/manrope-latin-600-normal-BqgrALkZ.woff
assets/manrope-latin-700-normal-BZp_XxE4.woff2
assets/manrope-latin-700-normal-DGRFkw-m.woff
icons/icon-128.png
icons/icon-16.png
icons/icon-32.png
icons/icon-48.png
index.html
manifest.json
service-worker-loader.js
```

## Production deployment evidence

- Worker URL: `https://creator-copilot-api.popcorntoohot.workers.dev`
- Production health: HTTP 200, `ok: true`, schema version 1.
- Privacy page: HTTP 200 with restrictive CSP. Hostile origin: HTTP 403. Invalid invite: HTTP 401.
- D1 migrations `0001_auth.sql` and `0002_usage.sql` applied to isolated development and production databases.
- Live bounded request: client request ID `709e6510-7b9d-4ac4-93e5-7f4a5de8a01f`; three recommendations, three evidence items, quota 9 of 10 remaining.
- Production accounting after two synthetic calls: two analyses, 558 input tokens, 541 output tokens. The first pre-fix call correctly charged quota but did not capture tokens; the second verified the deployed accounting fix.
- D1 schema contains no columns for public-page text, creator profile text, generated drafts, X handles, or analyzed URLs.

## Release evidence pending

- Final clean-install Chrome smoke test
- GitHub release URL and downloaded-artifact hash
- Chrome Web Store item ID and review status
