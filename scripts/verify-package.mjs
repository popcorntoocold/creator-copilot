import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { APPROVED_PERMISSIONS, PRODUCTION_API_ORIGIN, verifyArchive } from './verify-package-lib.mjs';

const distManifestPath = new URL('../apps/extension/dist/manifest.json', import.meta.url);
const archivePath = new URL('../release/creator-copilot-extension.zip', import.meta.url);
const rootPackagePath = new URL('../package.json', import.meta.url);
const extensionPackagePath = new URL('../apps/extension/package.json', import.meta.url);

assert.ok(existsSync(distManifestPath), 'Build output is missing manifest.json');
assert.ok(existsSync(archivePath), 'Packaged extension archive is missing');

const manifest = JSON.parse(readFileSync(distManifestPath, 'utf8'));
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
const extensionPackage = JSON.parse(readFileSync(extensionPackagePath, 'utf8'));
assert.equal(rootPackage.version, extensionPackage.version, 'Root and extension package versions differ');
assert.equal(manifest.version, extensionPackage.version, 'Built manifest and package versions differ');

const result = verifyArchive(new Uint8Array(readFileSync(archivePath)), {
  expectedVersion: extensionPackage.version,
  expectedApiOrigin: PRODUCTION_API_ORIGIN,
});
assert.deepEqual(result.manifest, manifest, 'Built and archived manifests differ');

console.log(
  `Package verified: ${result.files.length} files, ${APPROVED_PERMISSIONS.length} approved permissions, one production API host.`,
);
