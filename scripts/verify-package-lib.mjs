import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

export const PRODUCTION_API_ORIGIN = 'https://creator-copilot-api.popcorntoohot.workers.dev';
export const APPROVED_PERMISSIONS = ['activeTab', 'scripting', 'sidePanel', 'storage'];

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.txt']);
const allowedRemoteHosts = new Set([
  new URL(PRODUCTION_API_ORIGIN).hostname,
  'x.com',
  'www.x.com',
  'react.dev',
  'www.w3.org',
  'json-schema.org',
]);

function extension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function decodeTextAssets(archive) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return Object.entries(archive)
    .filter(([filename]) => textExtensions.has(extension(filename)))
    .map(([filename, bytes]) => {
      try {
        return [filename, decoder.decode(bytes)];
      } catch {
        throw new Error(`Text asset is not valid UTF-8: ${filename}`);
      }
    });
}

export function verifyArchive(archiveBytes, { expectedVersion, expectedApiOrigin }) {
  assert.equal(expectedApiOrigin, PRODUCTION_API_ORIGIN, 'Verifier production API origin changed unexpectedly');
  const archive = unzipSync(archiveBytes);
  const files = Object.keys(archive).sort();
  assert.ok(files.includes('manifest.json'), 'Archive is missing manifest.json');
  assert.ok(files.includes('index.html'), 'Archive is missing index.html');
  assert.ok(files.some((file) => file.startsWith('assets/') && file.endsWith('.js')), 'Archive is missing bundled JavaScript');

  for (const filename of files) {
    assert.equal(filename.endsWith('.map'), false, `Archive contains a source map: ${filename}`);
    assert.equal(/(^|\/)\.env(?:\.|$)/i.test(filename), false, `Archive contains an environment file: ${filename}`);
    assert.equal(/(^|\/)\.dev\.vars(?:\.|$)/i.test(filename), false, `Archive contains dev vars: ${filename}`);
    assert.equal(/(^|\/)(?:__tests__|tests?|fixtures?)(\/|\.)/i.test(filename), false, `Archive contains a test or fixture: ${filename}`);
    assert.equal(/(?:^|\.)(?:test|spec)\.[cm]?[jt]sx?$/i.test(filename), false, `Archive contains a test: ${filename}`);
  }

  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']));
  assert.equal(manifest.version, expectedVersion, 'Manifest version does not match the release version');
  assert.deepEqual([...manifest.permissions].sort(), [...APPROVED_PERMISSIONS].sort(), 'Manifest permissions changed');
  assert.deepEqual(manifest.host_permissions, [`${expectedApiOrigin}/*`], 'Manifest host permissions changed');
  const expectedIcons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };
  assert.deepEqual(manifest.icons, expectedIcons, 'Manifest icons changed');
  for (const [declaredSize, filename] of Object.entries(expectedIcons)) {
    const bytes = archive[filename];
    assert.ok(bytes && bytes.byteLength >= 24, `Archive is missing a valid ${declaredSize}px icon`);
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filename} is not a PNG`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.equal(view.getUint32(16), Number(declaredSize), `${filename} has the wrong width`);
    assert.equal(view.getUint32(20), Number(declaredSize), `${filename} has the wrong height`);
  }

  const textAssets = decodeTextAssets(archive);
  const combinedText = textAssets.map(([, text]) => text).join('\n');
  const javascriptText = textAssets.filter(([filename]) => extension(filename) === '.js').map(([, text]) => text).join('\n');
  assert.ok(javascriptText.includes(expectedApiOrigin), 'Bundled JavaScript does not contain the exact production API origin');
  assert.equal(/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(combinedText), false, 'Archive contains a secret-shaped value');
  assert.equal(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(combinedText), false, 'Archive contains a private key');
  assert.equal(/OPENAI_API_KEY\s*=/.test(combinedText), false, 'Archive contains a provider credential assignment');
  assert.equal(/https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?/i.test(combinedText), false, 'Archive contains a development endpoint');

  const urls = combinedText.match(/https?:\/\/[^\s"'`<>)}\]]+/g) ?? [];
  for (const rawUrl of urls) {
    let url;
    try {
      url = new URL(rawUrl.replace(/[.,;:]$/u, ''));
    } catch {
      continue;
    }
    assert.equal(url.hostname.includes('-dev.') || url.hostname.endsWith('.test'), false, 'Archive contains a development endpoint');
    assert.ok(allowedRemoteHosts.has(url.hostname), `Archive contains an unexpected remote host: ${url.hostname}`);
  }

  return { files, manifest };
}
