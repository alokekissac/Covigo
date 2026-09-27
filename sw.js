/**
 * Covigo service worker: caches map tiles you have already viewed, so the
 * map keeps working with poor or no signal while you walk.
 * Only tiles that were actually displayed are cached (no bulk prefetching),
 * in line with the OpenStreetMap tile usage policy.
 */
const CACHE = 'covigo-tiles-v1';
const MAX_TILES = 2000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || !url.includes('tile.openstreetmap.org')) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) { cache.put(e.request, res.clone()); trim(cache); }
      return res;
    })
  );
});
