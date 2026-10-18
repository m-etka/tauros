/* Çevrimdışı önbellek. VERSION her yayında otomatik değişir.
 * Eski Chrome (40-48) ile uyum: cache.addAll yerine tek tek fetch+put,
 * request.mode === 'navigate' yerine Accept başlığı da kontrol edilir. */
var VERSION = 'mandi-v1';
var FILES = [
  './',
  'style.css',
  'app.js',
  'bus.js',
  'mangala.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

function freshRequest(url) {
  try { return new Request(url, { cache: 'reload' }); } catch (e) { return new Request(url); }
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return Promise.all(FILES.map(function (url) {
        return fetch(freshRequest(url)).then(function (res) {
          if (!res || !res.ok) throw new Error('İndirilemedi: ' + url);
          return cache.put(url, res);
        });
      }));
    }).then(function () {
      if (self.skipWaiting) return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () {
      if (self.clients && self.clients.claim) return self.clients.claim();
    })
  );
});

function isPage(req) {
  if (req.mode === 'navigate') return true;
  var accept = req.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

function fromCache(key) {
  return caches.open(VERSION).then(function (cache) { return cache.match(key); });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sayfa açılışı: önbellekteki ana sayfa (internetsiz çalışır)
  if (isPage(req) && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(fromCache('./').then(function (hit) { return hit || fetch(req); }));
    return;
  }

  var path = url.pathname.replace(/^\//, '');
  event.respondWith(
    fromCache(path).then(function (hit) { return hit || fetch(req); })
  );
});
