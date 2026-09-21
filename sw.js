const CACHE_NAME = 'text-app-v2';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './css/print.css',
  './js/app.js',
  './js/editor-cm.js',
  './js/i18n-template.js',
  './js/search.js',
  './js/settings.js',
  './js/tabs.js',
  './js/util.js',
  './js/controllers/dialog.js',
  './js/controllers/hotkeys.js',
  './js/controllers/menu.js',
  './js/controllers/search.js',
  './js/controllers/settings.js',
  './js/controllers/window.js',
  './js/pwa-compat.js',
  './third_party/jquery/jquery-1.8.3.min.js',
  './third_party/material-components-web/material-components-web.min.css',
  './third_party/material-components-web/material-components-web.min.js',
  './third_party/material-design-icons/iconfont/material-icons.css',
  './third_party/material-design-icons/iconfont/MaterialIcons-Regular.woff2',
  './third_party/codemirror.next/codemirror.next.bin.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
