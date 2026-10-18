# HTML Multi-Page Accumulator for AI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](manifest.json)
[![Chrome & Firefox](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-orange.svg)](manifest.json)
[![Crafted with Gemini 3.8 Flash (Medium)](https://img.shields.io/badge/Crafted%20with-Gemini%203.8%20Flash%20(Medium)-8b5cf6.svg)](https://deepmind.google/technologies/gemini/)

A cross-browser extension (**Google Chrome, Microsoft Edge, Brave, and Mozilla Firefox**) designed to capture rendered `<body>` HTML across multiple paginated product pages (e.g. Page 1, Page 2, Page 3...) and compile them into a single, structured payload for AI analysis (**ChatGPT, Claude, Gemini, DeepSeek**).

Export your accumulated data in **Dual Mode**:
- 💾 **Save to File (`.html` or `.md`)**: Attach directly via the 📎 file upload button in ChatGPT / Claude / Gemini without cluttering your chat prompt.
- 📋 **Copy to Clipboard**: Quick paste for shorter snippets or prompt templates.

---

## Key Features

1. **Multi-Page Accumulation**:
   - Click on Page 1 &rarr; captured (`1` page in buffer).
   - Navigate to Page 2, click again &rarr; Page 2 is appended (`2` pages in buffer).
   - Structured delimiters (`<!-- PAGE 1 OF 3: URL -->`) separate each page with timestamps and source URLs.
2. **AI Token Optimization (DOM Cleaner)**:
   - Strips noisy boilerplate: `<script>`, `<style>`, inline SVGs, tracking pixels, ads, base64 images, and comments.
   - Preserves all essential product information: titles, specifications, prices, links, tables, and product attributes (`data-asin`, `data-sku`, `data-price`).
3. **Dual Export Modes**:
   - **HTML (`.html`)**: Cleaned or raw DOM preserving full hierarchy.
   - **Markdown (`.md`)**: Ultra-compact token footprint for strict context limits.
4. **On-Page Floating HUD Toast**:
   - Instant visual feedback on capture with live size and token estimates.
   - Quick one-click action buttons directly on the page: `💾 Save .html`, `📝 Save .md`, `📋 Copy`, `🗑️ Clear`.
5. **Dashboard Popup**:
   - Inspect individual captured page URLs with timestamps and single-item delete buttons.
   - Live token and size counter (`~KB` / `~Tokens`).
   - One-click **Clear Buffer** and **Download File**.

---

## Installation Guide

### Option A: Google Chrome / Edge / Brave (Unpacked)
1. Clone this repository:
   ```bash
   git clone https://github.com/normonds/html-accumulator-for-ai.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **"Developer mode"** to **ON**.
4. Click the **"Load unpacked"** button in the top-left.
5. Select the cloned repository folder.
6. The extension icon will appear in your browser toolbar. Pin it for quick access!

### Option B: Mozilla Firefox
1. Run the build script in this directory:
   ```bash
   node build-firefox.js
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **"Load Temporary Add-on..."**.
4. Select `dist-firefox/manifest.json` inside the repository directory.
5. The add-on is active and ready to test!

*(To share with others on Firefox without developer mode, submit the `dist-firefox` folder to addons.mozilla.org as "Unlisted" for free automated `.xpi` signing).*

---

## Keyboard Shortcuts

- **Capture & Append Page**: `Alt+Shift+C` (macOS: `Command+Shift+C`)
  - Captures the active page and appends it to the buffer without even opening the popup!

---

## How to Feed Multi-Page Products to AI

### Recommended: File Upload (📎)
1. Navigate to Page 1 of your product search results (e.g. Amazon, eBay, Shopify).
2. Press `Alt+Shift+C` (HUD toast confirms Page 1 captured).
3. Click to Page 2, press `Alt+Shift+C` (HUD toast confirms Page 2 added).
4. Repeat for any remaining pages.
5. Click **"💾 Save .html"** on the floating toast (or open popup &rarr; **"Download File"**).
6. In **ChatGPT**, **Claude**, or **Gemini**, click the **📎 Attach File** button and select the downloaded file.
7. Use a prompt like:
   ```
   Attached is a 3-page product listing dump (in cleaned HTML format).
   Please analyze all products across the pages and:
   1. Extract a table containing: Title, Price, Rating, and Key Specs.
   2. Identify the top 3 best value products based on specifications vs price.
   3. Highlight any out-of-stock items or duplicate listings.
   ```

---

## Running Automated Tests

A zero-dependency test suite is included:
```bash
node test/cleaner.test.js
```

---

## Authors & Acknowledgements

- **[normonds](https://github.com/normonds)** — Concept, Testing & Requirements
- **Gemini 3.8 Flash (Medium)** — Architecture, Code Implementation & Optimization

