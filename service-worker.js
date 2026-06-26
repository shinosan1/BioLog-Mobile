const CACHE_NAME = "biolog-mobile-v2.6.0";
const CACHE_URLS = [
  "./",
  "./index.html",
  "./readme.html",
  "./styles.css",
  "./db.js",
  "./form.js",
  "./backup.js",
  "./charts.js",
  "./csv.js",
  "./app.js",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

