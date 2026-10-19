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

#### 4. AI Agent Feature (gemini-flash-lite-latest & Retrotech Terminal Panel)
- **Requirement**:
  1. Add an AI agent feature powered by model `gemini-flash-lite-latest`.
  2. Add `ai.svg` to the bottom bar (`#status-bar`) to open it in a side panel, **off by default**.
  3. When off, apply a `0% saturation and 20% darker filter` to the SVG (`filter: saturate(0%) brightness(80%)`).
  4. When clicked, open the side panel to the left following the minimalistic retrotech design of the rest of the app with a chat box like a terminal where user asks for commands.
  5. Create agent tools for the AI to let it remove, replace, and add specific lines; and find and replace specific texts.
  6. Inspect `../Flashcards` for reference Gemini tool calling implementation without editing anything there.
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
    - Tool Calling Loop: `callGemini_(userPrompt)` handles multi-turn agent execution with the Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=...`), automatically processing function calls, sending back `functionResponse` results, and generating final conversational responses.
    - Terminal Slash Commands: Supports `/key <api-key>`, `/clear`, `/reset`, `/model`, and `/help`.
    - Key Management: Stores API key in `localStorage` or `sessionStorage` with a clean configuration dialog (`#ai-key-modal`).
  - **Side Panel (`#ai-panel`)**:
    - Located in `#window-container` between `#sidebar` and `#main-container`, expanding on the left.
    - Follows minimalistic retrotech terminal theme: monospaced font, terminal status badge (`READY` / `THINKING...`), command prompt (`❯`), tool call badges, syntax-highlighted / markdown results, draggable resizer handle (`#ai-panel-resizer`).
  - **Status Bar Button (`#status-ai`)**:
    - Added to `.status-bar-right` with `assets/ai.svg`.
    - CSS filter when off: `filter: saturate(0%) brightness(80%); opacity: 0.75;`.
    - CSS filter when on: `filter: none; opacity: 1;`.
  - **Offline & Cache**:
    - Registered `ai.svg` and `js/controllers/ai_agent.js` in `sw.js` and bumped cache to `text-app-v25`.
    - Registered `assets/ai.svg` in `build.py` `FILES_TO_COPY`.