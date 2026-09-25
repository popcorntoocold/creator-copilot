import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'X Request Screener',
  short_name: 'Screener',
  version: '0.2.0',
  description: 'Flags AI-written messages and likely spam accounts in your X message requests.',
  minimum_chrome_version: '114',
  permissions: [],
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
});
