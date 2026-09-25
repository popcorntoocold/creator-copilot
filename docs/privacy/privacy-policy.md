# Creator Copilot Privacy Policy

Last updated: September 24, 2026

Creator Copilot is a Chrome sidebar for planning content from public X pages. It never posts, sends messages, follows accounts, makes purchases, or changes your X account.

## When data is collected

The extension reads a supported public X page only after you select **Analyze this page**. It first shows the detected text, account details, URL, page type, and visible public metrics. Nothing is sent for AI analysis until you review that preview and select **Send for AI analysis**.

## Data processed for AI analysis

An AI request contains the confirmed public page context plus the creator profile fields you entered: public handle, display name, voice guidance, welcomed and prohibited topics, monetization destination, and weekly goal.

- Cloudflare processes the request as the API and database provider.
- OpenAI processes the confirmed request to produce recommendations.

## What stays on your device

Your creator profile, generated recommendations, experiment check-ins, and installation session token are stored in Chrome extension storage. The current page preview stays only in the open sidebar session. The invite code is discarded after activation.

Use **Settings → Delete local data** to erase locally stored profile, recommendations, check-ins, and session state.

## What the service stores

The service stores:

- hashed invite and session records;
- a random installation identifier;
- session creation, expiry, and revocation times;
- daily request and token counts; and
- a salted one-way hash of a network identifier for abuse prevention.

The service does not store public page text, creator profile text, generated drafts, X handles, analyzed X URLs, raw network addresses, or raw OpenAI response bodies.

## Retention and deletion

Installation sessions expire after 30 days and can be revoked from Settings. Pilot session and aggregate usage records are retained for security, quota enforcement, and operating the beta until they are deleted during routine service maintenance.

Because the service has no user accounts, it cannot reliably connect a support request to a pseudonymous record without the relevant session information. Do not post tokens or sensitive data in a public issue.

## Chrome permissions

- `sidePanel` opens the product beside the active page.
- `storage` saves creator-controlled settings and drafts locally.
- `activeTab` and `scripting` read the current supported public X page only after a user action.

The extension does not request persistent access to every website and intentionally refuses X direct-message routes.

## Security and choices

Invite and session credentials are stored as hashes on the service, API access is restricted to the published extension origin, request bodies are not written to application logs, and usage is rate-limited. No internet service is risk-free.

You can continue using local recommendations without activating AI, review every preview before sending, revoke AI access, or delete local data.

## Support

For a privacy or support question, open an issue at <https://github.com/popcorntoocold/creator-copilot/issues>. Do not include invite codes, session tokens, private messages, or other sensitive information.

This document describes the implemented public beta. It is not a claim of certification under any particular legal or security standard.
