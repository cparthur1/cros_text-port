# Text Editor - Progressive Web App (PWA)

**[Live Demo available on GitHub Pages](https://cparthur1.github.io/cros_text-pwa_port/)**

This is a modernized **Progressive Web App (PWA)** port of the original [Google Chrome OS Text App](https://github.com/GoogleChromeLabs/text-app). 

While the original Chrome app was archived and built around legacy Chrome Apps APIs, this fork has been completely re-engineered to run in **any modern web browser**, install as a standalone desktop application on Chrome OS, Linux, macOS, and Windows, and operate with zero external runtime dependencies.

---

## ✨ Features & Highlights

### 📁 Native File System & OS Integration
* **File System Access API**: Direct local file reading and writing with native OS file pickers on supported browsers (Chrome, Edge, Opera).
* **Non-Chromium Fallbacks**: Seamless upload/download fallback workflows for Safari and Firefox.
* **PWA File Handlers & Associations**: Open `.txt`, `.md`, `.js`, `.py`, `.json`, `.rs`, `.cpp`, and more directly from your OS file manager into the editor.
* **Launch Queue Support**: Cold starts open files instantly; launching files while running focuses the existing window and opens the file in a new tab (`focus-existing`).
* **Drag & Drop**: Drop files straight from your desktop or file manager into the window to open them.
* **External Modification Detection**: Automatically detects if an open file has been changed outside the editor and prompts to reload.
* **In-App Web Storage ("Save on the app")**: Save files directly into the webapp internal storage (up to 5 saves, max 1MB per file), organized in a folder button right below "Save as" in the sidebar.
* **Temp Save & Unsaved Recovery**: Protects active documents that are not yet autosaved to device storage in app storage (1MB limit), prompting to fix and save them to device storage upon app restart.
* **Session Persistence**: Restores previously open tabs across browser restarts, with graceful indicators for moved or missing files.

### ✍️ Modern Editing Experience
* **Zero jQuery / Pure Vanilla DOM**: Completely modernized codebase using native DOM APIs.
* **High-Contrast Theming**: Explicit theme definitions and `color-scheme` controls ensuring high contrast and zero white-on-white text across light, dark, and system themes.
* **CodeMirror 6 Powered**: Fast, extensible syntax highlighting and modern editor core.
* **Autosave with Frame Animation**: Edits automatically save in the background with a 2-frame saving indicator (`auto_saving_frame1.svg` / `auto_saving_frame2.svg`) and clear visual status indicators (saved, saving, error, missing).
* **Find and Replace (`Ctrl+F` / `Ctrl+H`)**: Search with live match counts, match navigation, inline replace, and replace-all.
* **Bottom Status Bar**: Real-time cursor position (Line, Column), selection count, word count, character count, and syntax mode.
* **Quick Symbols Menu (`Alt+S`)**: Searchable, categorized modal palette to insert mathematical, arrows, Greek, shapes, fractions, typographical symbols, and undo/redo (`⟲`, `⟳`).
* **Text Snippet HotBar (`Alt+C` / `Alt+V`)**: 10-slot horizontal clipboard hotbar with snippet preview squares for instant snippet overwriting and pasting.
* **Refined Header Layout**: Left-aligned document title with right-aligned quick search and navigation.

### 🌐 Cross-Platform & Offline
* **Installable PWA**: Install as a first-class desktop app on Chrome OS, Linux, macOS, and Windows.
* **Offline-Ready**: Full offline operation backed by Service Workers with versioned asset caching.
* **Dark & Light Themes**: Clean theme toggle persisted across sessions.
* **i18n Localization**: Multi-language support with automatic fallback.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Ctrl` + `O` | Open File |
| `Ctrl` + `S` | Save File |
| `Ctrl` + `Shift` + `S` | Save As |
| `Ctrl` + `N` | New Document Tab |
| `Ctrl` + `W` | Close Current Tab |
| `Ctrl` + `F` | Find / Search |
| `Ctrl` + `H` | Replace |
| `Alt` + `S` | Open Quick Symbols Menu |
| `Alt` + `C` | Open HotBar to overwrite slot with selected snippet |
| `Alt` + `V` | Open HotBar to paste snippet from slot |
| `Ctrl` + `Z` / `Ctrl` + `Y` | Undo / Redo |

---

## 🚀 Getting Started

### Running Locally
To run the app locally, serve the project root directory with any local HTTP server (required for Service Worker and File System Access API):

```bash
npx serve .
# or
python3 -m http.server 8000
```
Then open `http://localhost:8000` (or the port specified) in Chrome, Edge, Brave, Firefox, or Safari.

### Building CodeMirror Core (Optional)
The editor uses a custom prebuilt CodeMirror 6 bundle. If you modify the core editor extensions in `third_party/codemirror.next`:

```bash
cd third_party/codemirror.next
npm install
npm run rebuild
```

---

## 📜 Attribution & License

This project is a modernized fork of the archived [GoogleChromeLabs/text-app](https://github.com/GoogleChromeLabs/text-app).

* **Original Authors**: The Chromium Authors
* **License**: BSD 3-Clause License (See [LICENSE.md](LICENSE.md) for full text).

---
*Developed as a modernized fork to preserve and extend the functionality of the classic Chrome OS text editor for the modern web.*
