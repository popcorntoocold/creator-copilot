# Install and use Creator Copilot

## Build it

From the repository root in PowerShell:

```powershell
npm install
npm run package
```

The unpacked extension is written to `apps/extension/dist`. A portable archive is written to `release/creator-copilot-extension.zip`.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the repository’s `apps/extension/dist` folder. Select the folder itself, not `manifest.json`.
5. Open Chrome’s Extensions menu and pin **Creator Copilot**.

After a code update, run `npm run package` again and click the reload button on the Creator Copilot card at `chrome://extensions`.

## First use

1. Open a public profile or individual post on `x.com`.
2. Click the Creator Copilot toolbar icon. This user gesture opens the side panel and gives the extension temporary access to that active tab.
3. Complete the studio profile. Add a public handle, creator name, voice notes, welcomed topics, hard boundaries, destination, and weekly goal.
4. Read and accept the privacy disclosure.
5. Open **Analyze** and click **Analyze this page**.
6. Inspect the detected page type, handle, visible post or bio text, and public metrics.
7. Choose **Create recommendations locally**, or activate the invite-only AI beta and click **Send for AI analysis**, only if the preview is the context you intended to analyze.
8. Review and explicitly copy a draft. Creator Copilot never publishes it.

## What each view does

- **Today** shows up to three ready actions and daily completion progress.
- **Analyze** requests the current public X context, previews it, and creates local or invite-gated AI recommendations after confirmation.
- **Create** keeps current copyable drafts together.
- **Experiments** runs one focused growth experiment and stores weekly check-ins.
- **Settings** edits voice, boundaries, destination, and goal or deletes all locally stored profile, draft, and experiment data.

## Current MVP limits

- X public profiles, posts, and feeds are the only supported pages.
- X markup changes can make extraction fail closed until selectors are updated.
- Deterministic recommendations run locally. Invite-gated AI analysis sends only the confirmed preview and creator profile fields to the service.
- There are no accounts, cross-device sync, platform integrations, billing, analytics backend, or automatic actions.
- Deleting local data cannot be undone.

## Troubleshooting

- **“Open a public page on x.com”**: make the intended X tab active, then reopen the extension from its toolbar icon.
- **“Private-message pages are intentionally unavailable”**: navigate to a public profile or post. DMs are outside the product scope.
- **“Page not recognizable”**: wait for X to finish loading or open an individual post instead of a transient overlay.
- **The panel still shows an old version**: rebuild, then reload the extension card at `chrome://extensions`.
