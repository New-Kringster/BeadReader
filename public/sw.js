// BeadReader asset cache. Deliberately narrow: it only caches static, immutable
// assets (content-hashed scripts/styles, fonts) and images (book covers, webtoon
// art) — never HTML pages, RSC payloads, or /api responses. That keeps loads
// fast and cuts repeat requests without ever serving a stale app version (the
// in-app version watcher handles "please refresh").
const CACHE = "beadreader-assets-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("beadreader-assets-") && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Let the page trigger a full cache purge (used by the "Clear cache" button).
self.addEventListener("message", (event) => {
  if (event.data === "clear-cache") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const dest = req.destination;

  // Only cache genuine assets. Cross-origin allowed for images/fonts (covers,
  // artwork); scripts/styles only from our own origin (hashed, safe to keep).
  const cacheable =
    dest === "image" ||
    dest === "font" ||
    ((dest === "script" || dest === "style") && url.origin === self.location.origin);
  if (!cacheable) return;

  // Never touch API or Next data payloads.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached; // cache-first
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
