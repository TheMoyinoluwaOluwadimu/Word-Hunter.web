/* WordChunk service worker.
 *
 * - The app shell (index.html + its hashed JS/CSS) is cached on install so the game opens offline.
 * - Puzzles and their lists are network-first: a new day always wins, the cache only fills in when offline.
 * - Supabase (login, leaderboard, challenges) is never touched: it must stay live.
 * - A new version waits until the player taps "Refresh" (the page sends SKIP_WAITING), so it never
 *   reloads in the middle of a puzzle.
 *
 * BUILD_ID is stamped at build time (see vite.config.ts), so every deploy gets a byte-different file
 * and browsers notice there is an update.
 */
const BUILD_ID = '__BUILD_ID__';
const SHELL = `wordchunk-shell-${BUILD_ID}`;
const RUNTIME = 'wordchunk-runtime';
const FONTS = 'wordchunk-fonts';
const KEEP = [SHELL, RUNTIME, FONTS];

const scope = self.registration.scope; // e.g. https://site.example/
const INDEX = new URL('./index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const res = await fetch(new Request(scope, { cache: 'reload' }));
      await cache.put(INDEX, res.clone());
      // every hashed asset the page uses, so the first offline launch is not a blank screen
      const html = await res.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], scope).href);
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackKey ?? request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackKey ?? request);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await refresh) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // fonts (Google Fonts CSS + files)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }

  // everything else that is not ours (Supabase, analytics ...) goes straight to the network
  if (url.origin !== self.location.origin) return;

  // page loads: always try fresh, fall back to the cached shell offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, INDEX));
    return;
  }

  // hashed build files never change
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  // puzzles, challenge pool and the lists: the date picks the puzzle, so network first
  if (url.pathname.endsWith('.json') && /\/(puzzles|challenges)\//.test(url.pathname)) {
    event.respondWith(networkFirst(request, RUNTIME));
    return;
  }

  // icons, images, manifest
  event.respondWith(staleWhileRevalidate(request, RUNTIME));
});
