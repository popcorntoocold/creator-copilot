import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { zipSync } from 'fflate';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'apps/extension/dist');
const release = resolve(root, 'release');
const archivePath = resolve(release, 'creator-copilot-extension.zip');
const archiveTimestamp = new Date('2000-01-01T00:00:00.000Z');

function collect(directory) {
  const entries = {};
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, item.name);
    if (item.isDirectory()) {
      Object.assign(entries, collect(absolute));
      continue;
    }
    const name = relative(dist, absolute).replaceAll('\\', '/');
    entries[name] = [new Uint8Array(readFileSync(absolute)), { mtime: archiveTimestamp }];
  }
  return entries;
}

mkdirSync(release, { recursive: true });
const files = collect(dist);
writeFileSync(archivePath, zipSync(files, { level: 9 }));
console.log(`Packaged ${Object.keys(files).length} files to ${archivePath}`);
