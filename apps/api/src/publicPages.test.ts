import { describe, expect, it } from 'vitest';
import { createRouter } from './router';

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.creatorcopilot.test${path}`, init);
}

describe('public information pages', () => {
  const router = createRouter({ allowedOrigins: new Set(['chrome-extension://abcdefghijklmnopabcdefghijklmnop']) });

  it.each([
    ['/privacy', 'Creator Copilot Privacy Policy'],
    ['/support', 'Creator Copilot Support'],
  ])('serves %s as a secure, accessible HTML page', async (path, heading) => {
    const response = await router.fetch(request(path));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain('Last updated: September 24, 2026');
    expect(html).toContain('github.com/popcorntoocold/creator-copilot/issues');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<(?:img|link|iframe)[^>]+https?:/i);
  });

  it('documents the implemented data flow on the privacy page', async () => {
    const response = await router.fetch(request('/privacy'));
    const html = await response.text();

    expect(html).toContain('explicitly select Analyze this page');
    expect(html).toContain('OpenAI');
    expect(html).toContain('Cloudflare');
    expect(html).toContain('does not store the public page text');
    expect(html).toContain('Delete local data');
  });

  it('rejects non-GET methods without rendering a page', async () => {
    const response = await router.fetch(request('/privacy', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
