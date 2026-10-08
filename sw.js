const CACHE_NAME = 'arch-law-cache-v2.2';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=2.2',
  './app.js?v=2.1',
  './questions.js?v=2.1',
  './flashcards.js?v=2.1',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache failed:', url, e)))
      );
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
