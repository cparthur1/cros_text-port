const CACHE_NAME = 'text-app-v26';
const ASSETS = [
  './',
  './index.html',
  './pwa-manifest.json',
  './css/app.css',
  './css/print.css',
  './icon/16x16.png',
  './icon/32x32.png',
  './icon/48x48.png',
  './icon/64x64.png',
  './icon/96x96.png',
  './icon/128x128.png',
  './icon/256x256.png',
  './icon/maskable.svg',
  './icon/ico.svg',
  './assets/ai.svg',
  './assets/missing_file.svg',
  './assets/missing_doc.svg',
  './assets/auto_saving.svg',
  './assets/auto_saving_frame1.svg',
  './assets/auto_saving_frame2.svg',
  './assets/autosaved.svg',
  './assets/render_off.svg',
  './assets/render_on.svg',
  './assets/save.svg',
  './assets/sync_error.svg',
  './js/app.js',
  './js/background.js',
  './js/editor-cm.js',
  './js/i18n-template.js',
  './js/search.js',
  './js/settings.js',
  './js/tabs.js',
  './js/util.js',
  './js/controllers/ai_agent.js',
  './js/controllers/app_storage.js',
  './js/controllers/dialog.js',
  './js/controllers/hotbar.js',
  './js/controllers/hotkeys.js',
  './js/controllers/menu.js',
  './js/controllers/search.js',
  './js/controllers/settings.js',
  './js/controllers/shortcuts.js',
  './js/controllers/status.js',
  './js/controllers/symbols.js',
  './js/controllers/window.js',
  './js/pwa-compat.js',
  './third_party/material-components-web/material-components-web.min.css',
  './third_party/material-components-web/material-components-web.min.js',
  './third_party/material-design-icons/iconfont/material-icons.css',
  './third_party/material-design-icons/iconfont/MaterialIcons-Regular.woff2',
  './third_party/material-design-icons/iconfont/MaterialIcons-Regular.woff',
  './third_party/material-design-icons/iconfont/MaterialIcons-Regular.ttf',
  './third_party/marked/marked.min.js',
  './third_party/codemirror.next/codemirror.next.bin.js',
  './_locales/en/messages.json',
  './_locales/pt_BR/messages.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn('[SW] Failed to precache asset:', asset, err);
          });
        })
      );
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
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle navigation requests (PWA startup, reload, file open associations)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match('./index.html', { ignoreSearch: true }).then((indexResponse) => {
          if (indexResponse) {
            return indexResponse;
          }
          return caches.match('./', { ignoreSearch: true }).then((rootResponse) => {
            return rootResponse || fetch(event.request);
          });
        });
      }).catch(() => {
        return caches.match('./index.html', { ignoreSearch: true }).then((indexResponse) => {
          return indexResponse || caches.match('./', { ignoreSearch: true });
        });
      })
    );
    return;
  }

  // Handle static assets & subresources: Cache First, fallback to network
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Offline fetch failed for:', event.request.url);
        return new Response('', { status: 503, statusText: 'Service Unavailable (Offline)' });
      });
    })
  );
});
