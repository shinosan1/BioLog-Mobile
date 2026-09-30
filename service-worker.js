const CACHE_VERSION = "v2.13.9";
const APP_ROOT_URL = new URL("./", self.location.href);
const APP_SCOPE_KEY = encodeURIComponent(APP_ROOT_URL.pathname);
const CACHE_PREFIX = "biolog-mobile-" + APP_SCOPE_KEY + "-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const CACHE_URLS = [
  "./",
  "./index.html",
  "./README.html",
  "./CODE_REFERENCE.html",
  "./GLOSSARY.html",
  "./SHA256.html",
  "./LICENSE.html",
  "./PRIVACY_POLICY.html",
  "./TERMS_OF_USE.html",
  "./styles.css",
  "./consent.js",
  "./db.js",
  "./form.js",
  "./backup.js",
  "./charts.js",
  "./csv.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const INDEX_URL = new URL("./index.html", self.location.href).href;
const PRECACHE_URLS = new Set(CACHE_URLS.map((url) => new URL(url, self.location.href).href));

function fetchNoStore(request) {
  return fetch(request, { cache: "no-store" });
}

function isAppEntryNavigation(request, requestUrl) {
  if (request.mode !== "navigate") {
    return false;
  }

  return requestUrl.pathname === APP_ROOT_URL.pathname ||
    requestUrl.pathname === new URL("./index.html", self.location.href).pathname;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(
      CACHE_URLS.map((url) => new Request(
        new URL(url, self.location.href).href,
        { cache: "reload" }
      ))
    ))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      if (isAppEntryNavigation(event.request, requestUrl)) {
        return cache.match(INDEX_URL).then((cachedResponse) => {
          return cachedResponse || fetchNoStore(event.request);
        });
      }

      if (PRECACHE_URLS.has(event.request.url)) {
        return cache.match(event.request).then((cachedResponse) => {
          return cachedResponse || fetchNoStore(event.request);
        });
      }

      return fetchNoStore(event.request).then((response) => {
        if (response.ok) {
          return response;
        }
        return cache.match(event.request).then((cachedResponse) => cachedResponse || response);
      }).catch(() => cache.match(event.request));
    })
  );
});
