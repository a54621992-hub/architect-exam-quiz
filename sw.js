const CACHE_NAME = 'arch-law-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=2.0',
  './app.js?v=2.0',
  './questions.js?v=2.0',
  './flashcards.js?v=2.0',
  './manifest.json'
];

self.addEventListener('install', event => {
  // 強制立刻啟動新的 Service Worker
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  // 清除所有舊版本的快取
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First 策略：有網路時抓最新，沒網路時離線快取支援
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // 成功取得最新網路回應，同步快取
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 離線無網路時，使用快取
        return caches.match(event.request);
      })
  );
});
