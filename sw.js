const CACHE_NAME = 'text-app-v17';
const ASSETS = [
  './',
  './index.html',
  './pwa-manifest.json',
  './css/app.css',
  './css/print.css',
  './assets/missing_file.svg',
  './assets/auto_saving.svg',
  './assets/auto_saving_frame1.svg',
  './assets/auto_saving_frame2.svg',
  './assets/autosaved.svg',
  './assets/save.svg',
  './assets/sync_error.svg',
  './js/app.js',
  './js/editor-cm.js',
  './js/i18n-template.js',
  './js/search.js',
  './js/settings.js',
  './js/tabs.js',
  './js/util.js',
  './js/controllers/app_storage.js',
  './js/controllers/dialog.js',
  './js/controllers/hotbar.js',
  './js/controllers/hotkeys.js',
  './js/controllers/menu.js',
  './js/controllers/search.js',
  './js/controllers/settings.js',
  './js/controllers/status.js',
  './js/controllers/symbols.js',
  './js/controllers/window.js',
  './js/pwa-compat.js',
  './third_party/material-components-web/material-components-web.min.css',
  './third_party/material-components-web/material-components-web.min.js',
  './third_party/material-design-icons/iconfont/material-icons.css',
  './third_party/material-design-icons/iconfont/MaterialIcons-Regular.woff2',
  './third_party/codemirror.next/codemirror.next.bin.js',
  './_locales/en/messages.json',
  './_locales/pt_BR/messages.json',
  './_locales/es/messages.json',
  './_locales/fr/messages.json',
  './_locales/de/messages.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
