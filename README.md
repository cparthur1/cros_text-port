# Text Editor - Progressive Web App (PWA)

**[Live Demo available on GitHub Pages](https://cparthur1.github.io/chromeos-textapp_pwa-port/)**

This is a **Progressive Web App (PWA)** fork of the original [Google Chrome OS Text App](https://github.com/GoogleChromeLabs/text-app). 

While the original project is archived and was designed specifically for Chrome OS, this fork has been modernized to run in **any modern web browser** and can be installed as a standalone desktop application.

## Key PWA Features

*   **Installable**: Works as a standalone app on Windows, macOS, Linux, and Chrome OS via PWA installation.
*   **Offline Support**: Fully functional without an internet connection using Service Workers.
*   **Modern File System Access**: Uses the **File System Access API** to open and save local files directly from your browser.
*   **Auto Save**: Automatically saves open files in the background as you edit with debounce and tab/window synchronization.
*   **Find and Replace**: Built-in search and replace powered by CodeMirror 6 with match counts, navigation, inline replace, and replace-all (`Ctrl+F` / `Ctrl+H`).
*   **Storage**: Persists your settings and theme preferences using local storage polyfills.
*   **i18n Support**: Dynamic localization with fallback for local `file://` usage.

## Getting Started

### Quick Start
To run the app locally, simply open [index.html](index.html) in a modern web browser (Chrome or Edge recommended for full File System API support).

### Serving the App (Recommended)
For the best experience (including Service Worker support), serve the directory using a local web server:

```bash
npx serve .
# or
python3 -m http.server
```

## Prebuild CodeMirror

The editor uses CodeMirror 6. You must prebuild the bundle before running the app if you are making changes to the editor core.

```bash
cd third_party/codemirror.next
npm install
npm run rebuild
```

## Original Project & Attribution

This project is a fork of the [GoogleChromeLabs/text-app](https://github.com/GoogleChromeLabs/text-app), which is licensed under the **BSD 3-Clause License**. 

*   **Original Authors**: The Chromium Authors.
*   **License**: BSD 3-Clause (See [LICENSE.md](LICENSE.md) for details).

---
*Developed as a modernized fork to preserve and extend the functionality of the classic Chrome OS text editor for the open web.*
