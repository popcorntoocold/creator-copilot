# Chrome Web Store submission checklist

## Package identity

- [ ] Version is `0.2.0` in the manifest and package metadata.
- [ ] The submitted ZIP is byte-for-byte identical to the verified GitHub release artifact.
- [ ] The SHA-256 matches `docs/RELEASE-v0.2.0.md`.
- [ ] The extension ID is recorded and the Worker allowlist contains only its `chrome-extension://` origin.

## Listing

- [ ] Listing copy matches `docs/store/listing.md`.
- [ ] Single-purpose statement is used verbatim.
- [ ] Category and language are set.
- [ ] Homepage, support, and privacy URLs resolve without authentication.
- [ ] Screenshots use synthetic content and contain no credentials or private data.

## Privacy and permissions

- [ ] Data-use answers match `docs/store/data-use.md` and the current Web Store form.
- [ ] Each manifest permission has a narrow justification.
- [ ] Remote-code answer is **No**.
- [ ] No analytics or undisclosed telemetry is present.
- [ ] No direct-message, cookie, history, payment, or broad host access is present.

## Functional review

- [ ] Clean-profile install and side-panel launch work.
- [ ] Public profile, post, and feed extraction work; direct messages fail closed.
- [ ] The exact context is previewed before remote analysis.
- [ ] Local mode works without activation.
- [ ] Invite redemption, AI analysis, quota display, sign-out, and revoked-session handling work.
- [ ] Drafts require an explicit copy and are never posted automatically.
- [ ] Delete local data works and the privacy disclosure is reachable.

## Submission evidence

- [ ] Item ID recorded.
- [ ] Upload time and submitted package hash recorded.
- [ ] Review status and any reviewer correspondence recorded.
- [ ] Do not call the extension publicly available until the Web Store reports it published.
