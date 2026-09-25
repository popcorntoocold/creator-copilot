import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const distManifestPath = new URL('../apps/extension/dist/manifest.json', import.meta.url);
const archivePath = new URL('../release/creator-copilot-extension.zip', import.meta.url);

assert.ok(existsSync(distManifestPath), 'Build output is missing manifest.json');
assert.ok(existsSync(archivePath), 'Packaged extension archive is missing');

const manifest = JSON.parse(readFileSync(distManifestPath, 'utf8'));
assert.deepEqual(manifest.permissions ?? [], [], 'Extension must not request API permissions');
assert.equal(manifest.side_panel, undefined, 'Side panel must stay removed');
assert.equal(manifest.host_permissions, undefined, 'Worker calls rely on CORS, not host permissions');
const matches = manifest.content_scripts.flatMap((script) => script.matches).sort();
assert.deepEqual(matches, ['https://twitter.com/*', 'https://x.com/*'], 'Content script must only run on X');

const archive = unzipSync(new Uint8Array(readFileSync(archivePath)));
const files = Object.keys(archive).sort();
assert.ok(files.includes('manifest.json'), 'Archive is missing manifest.json');
assert.ok(files.some((file) => file.endsWith('.js')), 'Archive is missing bundled JavaScript');
assert.equal(files.some((file) => file.endsWith('.map')), false, 'Archive contains source maps');
assert.equal(files.some((file) => /(^|\/)\.env(?:\.|$)/.test(file)), false, 'Archive contains an environment file');
assert.equal(files.some((file) => /(?:test|fixture)\.[cm]?[jt]sx?$/.test(file)), false, 'Archive contains tests or fixtures');

console.log(`Package verified: ${files.length} files, content script on X only, no API permissions.`);
