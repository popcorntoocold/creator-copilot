# Install X Request Screener

1. From the repo root: `npm install && npm run package`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/dist` (the folder, not `manifest.json`).
4. Open `https://x.com/messages/requests`. Flagged requests get a red/amber stripe and badges; hover a badge for the reasons.

After pulling changes, run `npm run package` again and hit reload on the extension card.
