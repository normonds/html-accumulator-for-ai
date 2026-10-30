# AGENTS.md

Guidance for coding agents working on **HTML Multi-Page Accumulator for AI**, a Manifest V3 browser extension (Chrome/Edge/Brave and Firefox). It captures the rendered `<body>` of a series of pages, cleans each one to save tokens, and exports them together as one `.html` or `.md` file or to the clipboard.

## Project layout

Plain JavaScript with no bundler, no framework and no npm dependencies. Every file at the root ships as-is.

| File | Role |
| --- | --- |
| `manifest.json` | Chromium manifest (`background.service_worker`). |
| `manifest.firefox.json` | Firefox manifest. Same as the Chromium one except `background.scripts`. |
| `background.js` | Service worker/event script: toolbar badge, `capture-page` keyboard command, injects `content.js` + `styles.css` on demand. |
| `content.js` | Runs inside the page: DOM cleaning (`cleanDomForAI`), Markdown conversion (`domToMarkdown`), payload building, the floating HUD toast, downloads and clipboard, and the Ctrl+hover element inspector (Ctrl+Alt shows the full path; Ctrl+Shift copies `tag#id` or the shortest unique selector via `buildShortSelector`). |
| `popup.html` / `popup.js` | Dashboard popup: list of captured pages, format selection, auto-clipboard toggle, download/copy/clear. |
| `styles.css` | Styles for the in-page HUD (injected into host pages) and the popup. |
| `build-firefox.js` | Copies the shipped files into `dist-firefox/` and renames the Firefox manifest to `manifest.json`. |
| `test/cleaner.test.js` | `node:test` unit tests. |
| `icons/` | Extension icons (SVG source + 16/48/128 PNGs). |

## Commands

```bash
node test/cleaner.test.js   # run tests (Node 18+, zero deps)
node build-firefox.js       # build dist-firefox/ for Firefox
```

There is no lint or format step. Match the existing style: tabs for indentation, double quotes, semicolons, and `async`/`await`.

## Manual testing

- **Chromium:** go to `chrome://extensions`, turn on Developer mode, click "Load unpacked" and pick the repo root. After editing, press reload on the extension card and refresh the target tab.
- **Firefox:** run `node build-firefox.js`, then open `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → `dist-firefox/manifest.json`. Rebuild after every change.
- Check a capture by visiting a page with pagination, pressing `Alt+Shift+C` once per page, and confirming that the HUD toast, the badge count and the exported file all agree.

## Architecture notes

- **Cross-browser API:** every script starts with `const extAPI = typeof browser !== "undefined" ? browser : chrome;`. Always call `extAPI.*`, never `chrome.*` or `browser.*` directly.
- **State:** all data lives in `storage.local` under one key, `ai_html_accumulator_data`, shaped like:
  ```js
  {
    pages: [{ id, url, title, capturedAt, rawHtml, cleanedHtml, markdown, charCount, estimatedTokens }],
    settings: { format: "cleaned" | "raw" | "markdown", autoClipboard: boolean }
  }
  ```
  `content.js`, `popup.js` and `background.js` all read and write this key. If you change its shape, update all three, and cope with data already stored in the old shape.
- **Messages** (`{ action: ... }`):
  - to background: `updateBadge` (`count`), `triggerCapture`
  - to the content script: `capture`, `downloadFile` (`filename`, `content`, `mimeType`), `copyPayload` (`content`)
  - Async handlers call `sendResponse` and `return true`.
- **Re-injection guard:** `content.js` is wrapped in an IIFE guarded by `window.__AI_HTML_ACCUMULATOR_LOADED__`, because `background.js` may inject it again into tabs that already have it. Keep the guard.
- **Token estimate:** `chars / 4` everywhere.

## Gotchas

- **Payload logic is duplicated.** `buildCombinedPayload`/`escapeHtml` exist in `content.js`, again as `buildPayload` in `popup.js`, and as a copy in `test/cleaner.test.js`. The tests run against that copy, not the shipped code, so a change to the page delimiter format (`<!-- PAGE n OF m: url -->`) must be made in all three places.
- **Keep the manifests in sync.** Any change to permissions, version, commands, content scripts or icons goes into both `manifest.json` and `manifest.firefox.json`. Bump `version` in both.
- **New shipped files** must be added to `filesToCopy` in `build-firefox.js`, or the Firefox build will leave them out.
- **The HUD runs inside arbitrary host pages.** Keep its styles scoped under the `#ai-html-accumulator-hud` / `ai-html-accumulator-*` prefixes, and make sure `cleanDomForAI` keeps removing the HUD from captures.
- **The cleaner must keep product data.** Leave the `allowedAttrs` and `preservedDataAttrPrefixes` lists in `cleanDomForAI` alone (things like `href`, `data-asin`, `data-price`) unless there is a deliberate reason to change them.
- Browser-internal URLs (`chrome://`, `edge://`, `about:`, `chrome-extension://`) cannot be scripted, and `background.js` skips them on purpose.
- `dist-firefox/`, `*.zip`, `*.xpi` and sample exports are gitignored. Don't commit them.
