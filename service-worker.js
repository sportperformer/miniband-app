const CACHE_NAME = 'miniband-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './manifest.json',
  './sg-400.woff2',
  './sg-500.woff2',
  './sg-700.woff2',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cross-origin requests (np. odtwarzacz YouTube) - nie ingerujemy, zwykla siec
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin: najpierw siec (zawsze swieza wersja gdy jest polaczenie),
  // dopiero brak polaczenia przelacza na zapisana kopie offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
