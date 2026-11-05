## Agents need to write their impressions and notes about their work and how the project works to maintain consistency and help future agents work at the project

### Session Notes: Themes Fix & Markdown Live Preview (Oct 2026)

#### 1. Project Overview & Architecture
- **Origin**: This project is a Progressive Web App (PWA) port of the Chrome OS Text App.
- **Editor Engine**: CodeMirror 6 (bundled in `third_party/codemirror.next/codemirror.next.bin.js` and wrapped by `js/editor-cm.js`).
- **UI Framework**: Material Components Web (MDC v0.43+ in `third_party/material-components-web/`).
- **Compatibility Layer (`js/pwa-compat.js`)**: Polyfills `chrome.storage` (sync and local via `localStorage`), `chrome.i18n` (loads `_locales/*/messages.json` with fallback defaults), `chrome.fileSystem`, and File System Access API / PWA `launchQueue`.
- **Localization Engine (`js/i18n-template.js`)**: Scans elements with `i18n-content` and `i18n-values` and sets translated strings via `chrome.i18n.getMessage(key)`.
- **Service Worker (`sw.js`)**: Caches static assets for 100% offline support. **Important**: When adding new assets or libraries, add them to `ASSETS` in `sw.js` and bump `CACHE_NAME` (e.g. `text-app-v24`).

#### 2. Settings & Themes Fix
- **Issue**: Theme radio buttons under "THEMES" were not loading in the Settings sidebar.
- **Root Cause**:
  1. In `index.html`, the `i18n-content` attributes had capitalized keys (`DeviceThemeOption`, `LightThemeOption`, `DarkThemeOption`), whereas `_locales/*/messages.json` and `pwa-compat.js` defined them in camelCase (`deviceThemeOption`, `lightThemeOption`, `darkThemeOption`). Because of exact case lookup in `chrome.i18n.getMessage`, the labels resolved to empty strings and had empty innerHTML in HTML, rendering invisible labels.
  2. Radio button event listeners in `SettingsController.prototype.addInputListeners_` only listened to `input`. Standard DOM radio elements and MDC form-field clicks primarily dispatch `change`.
- **Solution Applied**:
  - Corrected `index.html` keys to `deviceThemeOption`, `lightThemeOption`, `darkThemeOption`, and added fallback text inside `<label>` tags.
  - Enhanced `chrome.i18n.getMessage` in `js/pwa-compat.js` with case-insensitivity/first-letter casing fallback.
  - Added both `change` and `input` event listeners to radio controls in `SettingsController`.
  - Added explicit radio `checked` synchronization in `SettingsController.prototype.show_`.

#### 3. Markdown Side-by-Side Live Preview & Bottom Bar Toggle
- **Requirement**: In the bottom status bar, when the active file is Markdown (`.md` or `.markdown`), transform the Language Mode disclaimer (`#status-mode`) into an interactive button with `render_off.svg` and `render_on.svg`. When ON, render the markdown side-by-side with CodeMirror live as the user types.
- **Implementation**:
  - **Status Button (`#status-mode`)**:
    - Markup updated in `index.html` to a `<button id="status-mode" class="status-item">` containing `<img id="status-mode-icon" class="status-mode-icon">` and `<span id="status-mode-text">`.
    - Non-markdown files: Acts as a standard static status indicator (pointer events disabled, icon hidden, displays language name like `JavaScript` or `Plain Text`).
    - Markdown files: Gains interactive class `status-button status-mode-md`, displays `render_off.svg` when preview is off or `render_on.svg` when preview is on, displays `Markdown`, and sets tooltip.
  - **Live Preview Container (`#md-preview-container`)**:
    - Nested cleanly inside `#editor` alongside CodeMirror's `.cm-editor`.
    - When active, `#editor.side-by-side-active` uses CSS flexbox: `.cm-editor` (`order: 1; flex: 1 1 50%; min-width: 0;`) and `#md-preview-container` (`order: 2; flex: 1 1 50%; min-width: 0; display: flex;`).
    - Responsive layout: Stacks vertically on screens <= 600px width.
    - CodeMirror is automatically re-measured via `editorView_.requestMeasure()` when toggling view.
  - **Live Rendering (`marked`)**:
    - Vendored standalone UMD library `third_party/marked/marked.min.js` (48kB, zero dependencies, offline compatible).
    - Listens to `docchange` event from CodeMirror to live-render markdown typed in real-time.
    - Full GitHub Flavored Markdown (GFM) support, tables, task lists, code blocks, blockquotes, headings.
    - Styled for both light (`body[theme="light"]`) and dark (`body[theme="dark"]`) themes using CSS variables.
    - External links clicked inside the preview open in a new tab via `window.open` rather than navigating away from the PWA.

#### 4. AI Agent Feature (gemini-flash-lite-latest & Minimalistic Material UI V2 Panel)
- **Requirement & Iterations**:
  1. Add an AI agent feature powered by model `gemini-flash-lite-latest`.
  2. Add `ai.svg` to the bottom bar (`#status-bar`) to open it in a side panel, **off by default**.
  3. When off, apply a `0% saturation and 20% darker filter` to the SVG (`filter: saturate(0%) brightness(80%)`).
  4. When clicked, open the side panel to the left following a minimalistic Material UI V2 design matching the rest of the app with light/dark theme synchronization.
  5. Remove retro header ("AI TERMINAL", "Ready", "TOOLS ACTIVE"), ASCII art, instructions, and the `>` prompt character from the input box.
  6. Support both question-answering about the active document and direct editing tool operations (`remove_lines`, `replace_lines`, `add_lines`, `find_and_replace`, `read_document`).
- **Architecture & Implementation Details**:
  - **Controller (`js/controllers/ai_agent.js`)**:
    - Created `AiAgentController(editor, tabs, settings)`.
    - Tools schema declared via `AiAgentController.TOOLS`:
      - `remove_lines(start_line, end_line)`: Surgical deletion of line ranges.
      - `replace_lines(start_line, end_line, new_content)`: Replacement of line ranges with updated code/text.
      - `add_lines(line_number, content, position)`: Inserts content `'before'` or `'after'` target line.
      - `find_and_replace(find_text, replace_text, match_case, replace_all)`: Find and replace text throughout document.
      - `read_document(start_line, end_line)`: Inspects document lines with line numbers.
    - CodeMirror 6 Dispatch: All edits execute via `this.editor_.editorView_.dispatch({ changes, scrollIntoView: true })`, which preserves undo/redo history (Ctrl+Z / Ctrl+Y), dirties the tab, and immediately triggers markdown preview live updates.
    - System Prompt & Inquiries: Instructs Gemini to distinguish between questions/inquiries (explanations, summaries, syntax, general questions answered directly in text) and edit requests (which trigger tool calls).
    - Tool Calling Loop: `callGemini_(userPrompt)` handles multi-turn agent execution with the Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=...`), automatically processing function calls, sending back `functionResponse` results, and generating final conversational responses.
    - Terminal Slash Commands: Supports `/key <api-key>`, `/clear`, `/reset`, `/model`, and `/help`.
    - Key Management: Stores API key in `localStorage` or `sessionStorage` with a clean configuration dialog (`#ai-key-modal`).
  - **Material UI V2 Side Panel (`#ai-panel`)**:
    - Located in `#window-container` between `#sidebar` and `#main-container`, expanding on the left.
    - Matches the app's light/dark theme seamlessly using CSS variables (`--ta-background-color`, `--ta-ui-text-color`, `--ta-divider-color`, `--ta-accent-color`, `--ta-highlight-color`).
    - Clean Material header with title "Assistant" and MDC icon buttons (`key`, `delete_outline`, `close`).
    - Clean Material chat bubbles: right-aligned user bubble, left-aligned assistant bubble with markdown rendering, and clean Material tool execution chips.
    - Minimalist Material input container with rounded input wrapper and send icon button (no `>` prompt).
    - Draggable resizer handle (`#ai-panel-resizer`).
  - **Status Bar Button (`#status-ai`)**:
    - Added to `.status-bar-right` with `assets/ai.svg`.
    - CSS filter when off: `filter: saturate(0%) brightness(80%); opacity: 0.75;`.
    - CSS filter when on: `filter: none; opacity: 1;`.
  - **Offline & Cache**:
    - Registered `ai.svg` and `js/controllers/ai_agent.js` in `sw.js` and bumped cache to `text-app-v25`.
    - Registered `assets/ai.svg` in `build.py` `FILES_TO_COPY`.

### Session Notes: Offline PWA Fix (Nov 2026)

#### 1. Issue Description
- The PWA was failing to open when the device was offline (displaying browser network error / dino page or failing on launch).

#### 2. Root Cause Analysis
1. **Navigation Request Handling & Query Strings**:
   - `sw.js` did not differentiate between HTML navigation requests (`mode: 'navigate'`) and subresource requests.
   - Exact URL matching (`caches.match(event.request)`) was used without `{ ignoreSearch: true }`. When opened from OS app launchers, PWA shortcuts, file associations, or with query parameters (e.g. `?param=pwa` or `?launch=true`), the exact cache match missed.
   - When the cache missed, `fetch(event.request)` threw an unhandled `TypeError: Failed to fetch` without a `.catch()`, causing the promise passed to `respondWith()` to reject and Chrome to show the offline error screen.
2. **Missing PWA Icons & Font Fallbacks in Cache**:
   - The app's 9 icons in `icon/` (`16x16.png`, `32x32.png`, `48x48.png`, `64x64.png`, `96x96.png`, `128x128.png`, `256x256.png`, `maskable.svg`, `ico.svg`) were not precached in `ASSETS`.
   - Missing font formats (`.woff`, `.ttf`) in `material-design-icons/iconfont/` were not precached.
3. **Fragile Pre-caching Mechanism**:
   - Standard `cache.addAll(ASSETS)` rejects the entire installation promise if even one resource encounters a network or HTTP error, resulting in no active service worker.
4. **Unhandled Offline Errors on Registration & Controller Reload Loops**:
   - In `index.html`, `registration.update()` lacked `.catch()`, producing unhandled promise rejections when offline.
   - The `controllerchange` listener reloaded the page indiscriminately even on initial controller claim, interrupting offline startup.
5. **i18n Offline Fallback Failure**:
   - In `js/pwa-compat.js`, `en-US` locales attempted to fetch non-existent `_locales/en_US/messages.json`. When offline, the rejection bypassed the `.then(res => !res.ok)` fallback logic.

#### 3. Solution Applied
1. **Robust Navigation Fallback Strategy in `sw.js`**:
   - Explicitly handled `event.request.mode === 'navigate'`.
   - Used `caches.match(event.request, { ignoreSearch: true })` with fallback to `./index.html` or `./`.
   - Ensured the navigation handler always returns a response and never throws an unhandled rejection.
2. **Dynamic Asset Caching & Offline Safe Rejection**:
   - For subresources, implemented Cache-First with `{ ignoreSearch: true }` and dynamic runtime caching of successful requests.
   - Provided graceful fallback (`503 Service Unavailable (Offline)`) on cache misses when offline to avoid crashing the worker.
3. **Complete Asset Pre-caching**:
   - Added all `icon/*` assets, missing SVG files, and fallback font formats to `ASSETS` in `sw.js`.
   - Wrapped pre-caching in `Promise.all(ASSETS.map(asset => cache.add(asset).catch(...)))` for resilience.
   - Cleaned up `_locales` to strictly support English (`en`) and Portuguese (`pt_BR`) per user instructions.
   - Bumped cache to `text-app-v26`.
4. **Safe Service Worker Controller & Update Handling in `index.html`**:
   - Caught errors on `registration.update().catch(...)`.
   - Guarded `controllerchange` to only reload on actual upgrades when a controller was already present.
5. **Locale Normalization in `js/pwa-compat.js`**:
   - Normalized system languages directly to `pt_BR` or `en`, eliminating unnecessary 404 network fetches.
6. **Modern Web Metadata**:
   - Added `<meta name="mobile-web-app-capable" content="yes">` to `index.html`.