# SN Utils GitHub Sync — Chrome Extension

## Overview
A cross-browser extension (Chrome, Edge, Firefox) that automatically merges custom slash commands into `window.top.snuslashcommands` on every ServiceNow page load. Commands can be entered manually or synced from a public GitHub file / custom URL.

## Project Structure
```
├── manifest.json        # Manifest V3 — Chrome/Edge/Firefox
├── background.js        # Service worker — handles remote sync (fetch)
├── content_script.js    # ISOLATED world — reads storage, sets data attr
├── page_script.js       # MAIN world — polls snuslashcommands, merges
├── popup.html           # Popup UI (Home, Settings, About)
├── popup.css            # Styles
├── popup.js             # Popup logic (source modes, save, sync)
├── icons/               # Extension icons (16, 48, 128 px)
└── CLAUDE.md            # This file
```

## Key Technical Details

### Permissions
- `storage` — persist commands and sync config
- `alarms` — periodic sync check (hourly alarm, 24h threshold)
- `host_permissions` — `raw.githubusercontent.com` and `api.github.com` for GitHub sync

### Content Script Architecture (CSP-safe)
ServiceNow pages have strict CSP that blocks inline `<script>` tags. Two content scripts communicate via a DOM data attribute:

| File | World | Access | Role |
|---|---|---|---|
| `content_script.js` | ISOLATED | `chrome.storage` | Reads commands, sets `data-sn-github-sync` attr on `<html>` |
| `page_script.js` | MAIN | `window.top.*` | Polls for attr + `snuslashcommands`, merges via `Object.assign` |

### Sync Modes
- **Manual** — user edits JSON in the popup textarea
- **GitHub** — fetches `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` once per day
- **Custom URL** — fetches any URL returning a JSON object (advanced, no auth, no guarantees)

### Background Service Worker
- Handles all remote fetches (content scripts can't cross-origin fetch under page CSP)
- Listens for `{ action: "sync", force: bool }` messages from content scripts and popup
- Creates a `chrome.alarms` alarm that fires hourly; only fetches if `lastSync` > 24h ago
- Also syncs on extension install/update

### Storage Schema
```
syncMode        "manual" | "github" | "url"
slashCommands   { cmdName: { url, hint, fields, order, overwriteurl }, ... }
githubRepo      "owner/repo"
githubPath      "path/to/file.json"
githubBranch    "main"
customUrl       "https://..."
lastSync        timestamp (ms)
```

### Expected JSON Format
```json
{
  "test": {
    "url": "https://example.com",
    "hint": "Test command",
    "fields": "",
    "order": 1,
    "overwriteurl": ""
  }
}
```

## Loading the Extension

### Chrome / Edge
1. `chrome://extensions` (or `edge://extensions`) → Developer mode → Load unpacked.

### Firefox
1. `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
2. Requires Firefox 128+ (`world: "MAIN"` support).

## Development Notes
- No build step — plain HTML/CSS/JS.
- No external dependencies.
- Custom URL sync: the background service worker fetches via extension origin, so CORS is handled by `host_permissions` for GitHub domains. Custom URLs that are not in `host_permissions` may fail if the server doesn't send CORS headers.
