const CACHE_NAME = "biolog-mobile-v2.13.6";
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
      names.filter((name) => name.startsWith("biolog-mobile-") && name !== CACHE_NAME).map((name) => caches.delete(name))
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
    fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
  );
});

