# Chrome Web Store data-use answers

Use these answers as the source of truth for the v0.2.0 submission. Recheck them against the final package and the current Web Store form before submitting.

## Permission justifications

- `sidePanel`: displays the product alongside the active X page.
- `storage`: stores the creator profile, recommendations, experiment check-ins, and optional AI session token in extension-local Chrome storage.
- `activeTab`: grants temporary access to the tab the creator explicitly chose by opening the extension.
- `scripting`: runs the bundled extraction function on that active tab after **Analyze this page** is selected.
- Production API host permission: allows invite redemption, AI analysis, and session revocation only at the exact Creator Copilot Worker origin.

No `<all_urls>` permission, broad persistent site access, cookies permission, browsing-history permission, identity permission, X API access, or direct-message access is requested.

## Remote code

No. All executable extension code is packaged in the extension. The backend returns structured data, not executable JavaScript or WebAssembly. OpenAI output is schema-validated text data rendered as creator-reviewable recommendations.

## Data categories

The extension handles:

- website content selected by the user: visible text, public account details, public metrics, page type, and URL from a supported public X page;
- user-provided content: creator voice guidance, topics, boundaries, destination, and weekly goal;
- authentication information: an invite is exchanged for a pseudonymous installation session token; and
- coarse abuse-prevention data: the service hashes a network identifier and counts requests.

It does not handle private X messages, passwords, cookies, payment data, precise location, health data, or personal communications.

## Purpose and transfer

Selected data is used only to provide the requested content-planning and AI-analysis feature, secure the service, and enforce beta quotas. Confirmed AI inputs are processed by Cloudflare and OpenAI to provide the feature. They are service providers, not data brokers. Creator Copilot does not sell user data, use it for unrelated advertising, or use it for credit or lending decisions.

## User controls

- Extraction begins only after a user action.
- The extracted context is previewed before any AI request.
- AI access is optional; local recommendations remain available.
- Copy is explicit and nothing is posted automatically.
- AI sessions can be revoked in Settings.
- Local stored data can be deleted in Settings.

## Disclosure checks before submission

- Confirm the deployed privacy and support URLs resolve publicly.
- Confirm the final API host permission matches the deployed Worker exactly.
- Confirm the store questionnaire wording still maps to these categories.
- Confirm no analytics, telemetry, remote code, new data category, or new permission was added after this document was reviewed.
