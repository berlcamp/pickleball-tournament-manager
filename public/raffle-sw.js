// Service worker for the raffle draw screen (scope: /raffle-draw/).
//
// Keeps the draw page and the scripts, styles and fonts it loads in Cache
// Storage, so the screen can be reopened with no internet. The page itself
// handles drawing offline and uploading winners later; this file only makes
// sure there is a page to open.
//
// Bump CACHE when this file's behaviour changes; old caches are removed on
// activate.
const CACHE = "raffle-draw-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("raffle-draw-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page sends what it loaded before this worker took control.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "precache" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map(async (url) => {
          if (await cache.match(url)) return;
          const res = await fetch(url).catch(() => null);
          if (res && res.ok && !res.redirected) await cache.put(url, res);
        }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The page: always try the network so it carries the latest entries and
  // winners, and fall back to the last copy when there is no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // A redirect means the operator was sent to sign in — not a copy
          // of the draw page worth keeping.
          if (res.ok && !res.redirected) {
            const cache = await caches.open(CACHE);
            await cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          const cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;
          throw err;
        }
      })(),
    );
    return;
  }

  // Build output: file names are content-hashed, so a cached copy is never
  // stale.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      })(),
    );
  }
});
