import { defineManifest } from '@crxjs/vite-plugin';
import { PRODUCTION_API_ORIGIN } from './src/releaseConfig.ts';

export default defineManifest({
  manifest_version: 3,
  name: 'Creator Copilot',
  short_name: 'Copilot',
  version: '0.2.0',
  description: 'A creator-controlled planning sidebar for public X pages.',
  minimum_chrome_version: '114',
  permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
  host_permissions: [`${PRODUCTION_API_ORIGIN}/*`],
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'Open Creator Copilot',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  side_panel: {
    default_path: 'index.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
});
