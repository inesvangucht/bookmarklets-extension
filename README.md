# ⚡ Bookmarklets — Chrome Extension

A floating sidebar with quick-access bookmarklets for web developers. Navigate paths, inject query strings, run JS snippets, swap URL segments, and switch between environments — all from a clean sidebar that only appears on sites you configure.

Built for AEM developers but useful for anyone who works across multiple web environments.

## Features

- **Floating sidebar** — slim tab on the right edge of the page, slides open on click
- **5 bookmarklet types** — path navigation, query injection, JS snippets, URL find & replace, and environment switching
- **URL roots** — sidebar only appears on domains you allow (global roots or grouped)
- **URL groups** — organise roots into named sets (e.g. "Local IPs", "Staging", "Production")
- **Bookmarklet group linking** — link bookmarklet groups to URL groups so they only appear where relevant
- **Drag & drop** — reorder bookmarklets within and across groups
- **Search** — filter across all bookmarklets instantly
- **Export / Import** — back up and share your bookmarklets as JSON
- **Syncs** — all data stored in `chrome.storage.sync`, syncs across your Chrome profile
- **Shadow DOM** — sidebar styles are fully isolated from the host page

## Installation

### From the Chrome Web Store
1. Visit the [Bookmarklets extension page](#) on the Chrome Web Store
2. Click **Add to Chrome**
3. Click the ⚡ icon in your toolbar and go to **Settings** to add URL roots

### Manual (developer mode)
1. Download or clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select this folder
5. Done — the ⚡ icon appears in your toolbar

## Quick Start

1. Click the ⚡ toolbar icon → **Settings**
2. Add a URL root (e.g. `localhost:4502` or `author.myco.com`)
3. Visit a matching page — the **◀** tab appears on the right edge
4. Click it to open the sidebar
5. Click **+** to add a group, then **+ Add bookmarklet** inside it

## Bookmarklet Types

| Type | What it does | Example |
|---|---|---|
| **Path navigation** | Replaces the URL path, keeps the origin | `/system/console/bundles` |
| **Query injector** | Appends a query param to the current URL | `nocache=true` |
| **JS snippet** | Runs JavaScript in the page context | `javascript:(function(){...})()` |
| **URL find & replace** | Swaps a string in the current URL | `prod.myco.com` → `staging.myco.com` |
| **Switch root** | Jumps to a different origin, keeps the full path | `dev.myco.com` |

## Dynamic Tokens

Any text field in a bookmarklet config supports these tokens:

| Token | Resolves to |
|---|---|
| `{random}` | Random 8-char string |
| `{random:N}` | Random N-char string |
| `{ts}` | Unix timestamp |
| `{date}` | ISO date (YYYY-MM-DD) |

## URL Root Patterns

| Pattern | Matches |
|---|---|
| `author.myco.com` | Exact domain |
| `localhost:4502` | Domain with port |
| `192.168.1.10` | IP address |
| `192.168.1.*` | IP range wildcard |
| `*.myco.com` | Subdomain wildcard |

Protocols and paths are stripped automatically — pasting a full URL works fine.

## Privacy

- **No data collection** — all data stays in your browser's `chrome.storage.sync`
- **No analytics, no tracking, no external requests**
- **No remote code** — everything runs locally
- The `<all_urls>` permission is required so the sidebar can appear on any user-configured domain. The extension only activates on pages matching your configured URL roots.

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome | ✅ Fully supported (Manifest V3) |
| Edge | ✅ Works without changes |
| Brave | ✅ Works without changes |
| Opera | ✅ Works without changes |
| Firefox | ⚠️ Needs minor tweaks (`browser_specific_settings` + `browser.*` namespace) |
| Safari | ❌ Requires Xcode + Apple Developer account |

## License

MIT © Ines Van Gucht

The code is open source — read it, learn from it, fork it. Issues and ideas
are very welcome.
