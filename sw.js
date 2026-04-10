// ============================================================
// ARPA Molise — Service Worker v1.0
// Cache Strategy:
//   - Shell (HTML, CSS inline, manifest): Cache First
//   - Librerie CDN (html5-qrcode): Cache First
//   - API calls: Network First con fallback cache per liste
//     (tecnici, laboratori, collocazioni cambiano raramente)
// ============================================================

var CACHE_NAME = 'arpa-registro-v1';
var SHELL_URLS = [
  './arpa_app.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

// Liste cacheable (cambiano raramente)
var CACHE_API_ACTIONS = ['tecnici', 'laboratori', 'collocazioni'];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Pre-cache shell');
      return cache.addAll(SHELL_URLS).catch(function(err) {
        console.log('[SW] Pre-cache parziale:', err.message);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API GAS calls: Network First, cache le liste statiche
  if (url.pathname.indexOf('/macros/') !== -1 || url.hostname.indexOf('script.google') !== -1) {
    var params = url.searchParams;
    var action = (params.get('action') || '').toLowerCase();
    var isCacheable = CACHE_API_ACTIONS.indexOf(action) !== -1;

    if (isCacheable) {
      // Network first, fallback cache
      event.respondWith(
        fetch(event.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        }).catch(function() {
          return caches.match(event.request);
        })
      );
    }
    // Non-cacheable API: passa direttamente alla rete
    return;
  }

  // Shell e CDN: Cache First
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Salva in cache solo risposte valide
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
