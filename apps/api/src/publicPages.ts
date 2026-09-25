export const PUBLIC_PAGE_LAST_UPDATED = 'September 24, 2026';
export const SUPPORT_URL = 'https://github.com/popcorntoocold/creator-copilot/issues';

const sharedStyles = `
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; color: #211a21; background: #fff9f7; }
  body { margin: 0; }
  main { width: min(46rem, calc(100% - 2rem)); margin: 0 auto; padding: 4rem 0 6rem; }
  h1, h2 { font-family: Georgia, serif; line-height: 1.12; }
  h1 { font-size: clamp(2.25rem, 8vw, 4rem); margin: 0 0 .5rem; }
  h2 { margin-top: 2.25rem; }
  p, li { line-height: 1.7; }
  .eyebrow { color: #9a315f; font-size: .78rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .updated { color: #695e67; }
  a { color: #8c2454; }
  .notice { background: #fff; border: 1px solid #eadce2; border-radius: 1rem; padding: 1rem 1.25rem; }
`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${sharedStyles}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export const privacyPage = page(
  'Creator Copilot Privacy Policy',
  `<p class="eyebrow">Creator-controlled by design</p>
  <h1>Creator Copilot Privacy Policy</h1>
  <p class="updated">Last updated: ${PUBLIC_PAGE_LAST_UPDATED}</p>
  <p class="notice">Creator Copilot is a Chrome sidebar for planning content from public X pages. It never posts, sends messages, follows accounts, makes purchases, or changes your X account.</p>

  <h2>When data is collected</h2>
  <p>The extension reads a supported public X page only after you explicitly select Analyze this page. It first shows the detected text, account details, URL, page type, and visible public metrics. Nothing is sent for AI analysis until you review that preview and select Send for AI analysis.</p>

  <h2>Data processed for AI analysis</h2>
  <p>An AI request contains the confirmed public page context plus the creator profile fields you entered: public handle, display name, voice guidance, welcomed and prohibited topics, monetization destination, and weekly goal. Cloudflare processes the request as the API and database provider. OpenAI processes the confirmed request to produce recommendations.</p>

  <h2>What stays on your device</h2>
  <p>Your creator profile, generated recommendations, experiment check-ins, and installation session token are stored in Chrome extension storage. The current page preview stays only in the open sidebar session. The invite code is discarded after activation. Use Settings → Delete local data to erase locally stored profile, recommendations, check-ins, and session state.</p>

  <h2>What the service stores</h2>
  <p>The service stores hashed invite and session records, a random installation identifier, session creation, expiry and revocation times, daily request and token counts, and a salted one-way hash of a network identifier for abuse prevention. It does not store the public page text, creator profile text, generated drafts, X handles, analyzed X URLs, raw network address, or raw OpenAI response bodies.</p>

  <h2>Retention and deletion</h2>
  <p>Installation sessions expire after 30 days and can be revoked from Settings. Pilot session and aggregate usage records are retained for security, quota enforcement, and operating the beta until they are deleted during routine service maintenance. Because the service has no user accounts, it cannot reliably connect a support request to a pseudonymous record without the relevant session information. Do not post tokens or sensitive data in a public issue.</p>

  <h2>Chrome permissions</h2>
  <ul>
    <li><strong>sidePanel</strong> opens the product beside the active page.</li>
    <li><strong>storage</strong> saves creator-controlled settings and drafts locally.</li>
    <li><strong>activeTab</strong> and <strong>scripting</strong> read the current supported public X page only after a user action.</li>
  </ul>
  <p>The extension does not request persistent access to every website and intentionally refuses X direct-message routes.</p>

  <h2>Security and choices</h2>
  <p>Invite and session credentials are stored as hashes on the service, API access is restricted to the published extension origin, request bodies are not written to application logs, and usage is rate-limited. No internet service is risk-free. You can continue using local recommendations without activating AI, review every preview before sending, revoke AI access, or delete local data.</p>

  <h2>Support</h2>
  <p>For a privacy or support question, open an issue at <a href="${SUPPORT_URL}">github.com/popcorntoocold/creator-copilot/issues</a>. Do not include invite codes, session tokens, private messages, or other sensitive information.</p>`,
);

export const supportPage = page(
  'Creator Copilot Support',
  `<p class="eyebrow">Help for the public beta</p>
  <h1>Creator Copilot Support</h1>
  <p class="updated">Last updated: ${PUBLIC_PAGE_LAST_UPDATED}</p>
  <p class="notice">Creator Copilot supports public X profiles, individual posts, and feeds. Direct messages and automatic posting are outside its scope.</p>

  <h2>Quick fixes</h2>
  <ul>
    <li>Make the intended public X tab active, then open Creator Copilot from its toolbar icon.</li>
    <li>If a page cannot be recognized, wait for X to finish loading or open the individual post.</li>
    <li>If AI activation fails, check the invite exactly once; invite codes are single-use.</li>
    <li>If an AI session expires or is revoked, local planning still works. A new invite is required to reactivate AI.</li>
    <li>Creator Copilot only prepares copy. Review it, then use Copy; it will not publish for you.</li>
  </ul>

  <h2>Request help or report a bug</h2>
  <p>Open an issue at <a href="${SUPPORT_URL}">github.com/popcorntoocold/creator-copilot/issues</a> and include the extension version, Chrome version, page type, and the visible error message. Never include an invite code, session token, private-message content, or another person's non-public information.</p>

  <h2>Privacy</h2>
  <p>Read the <a href="/privacy">Creator Copilot Privacy Policy</a> for the data flow, permissions, retention, and deletion controls.</p>`,
);

export function publicPageResponse(pathname: string, method: string): Response | null {
  const html = pathname === '/privacy' ? privacyPage : pathname === '/support' ? supportPage : null;
  if (!html) return null;

  const headers: HeadersInit = {
    'cache-control': 'public, max-age=300',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'content-type': 'text/html; charset=utf-8',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
  if (method !== 'GET') {
    return new Response('Method not allowed.', { status: 405, headers: { ...headers, allow: 'GET' } });
  }
  return new Response(html, { status: 200, headers });
}
