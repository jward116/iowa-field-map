/* =====================================================================
   Iowa Tribe Field Map — offline service worker

   Rural Richardson, Brown and Doniphan counties have real dead zones. The
   address engine already keeps logging offline from its cached corridor, but
   without this the basemap goes black and the app itself won't even open on a
   cold start with no bars.

   Two caches, deliberately separate:
     SHELL  — the app and its libraries. Small, versioned, replaced wholesale
              on deploy. Cache-first so the app opens instantly with no signal.
     TILES  — basemap imagery. Large, capped, LRU-ish. Cache-first with a
              background refresh so the map stays drawn where you have been.

   GIS service responses are NEVER cached. Parcel owners and address points must
   be live, and the address engine has its own corridor cache with eviction —
   caching them here would serve stale ownership without anyone realising.
   ===================================================================== */

/* Cache names carry the build stamp, passed in by the page at registration time
   (sw.js?build=...). A deploy therefore retires its predecessor's caches on its own
   rather than depending on someone remembering to bump a constant here. */
const VERSION     = new URL(self.location).searchParams.get('build') || 'v1';
const SHELL_CACHE = `field-map-shell-${VERSION}`;
const TILE_CACHE  = `field-map-tiles-${VERSION}`;

const MAX_TILES   = 3000;          // ~30–60 MB depending on the basemap
const TILE_TRIM   = 300;           // evict in batches; trimming one at a time thrashes

const SHELL = [
    './',
    './index.html',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.js',
    'https://unpkg.com/esri-leaflet@3.0.10/dist/esri-leaflet.js'
];

const isTile = url =>
    /basemaps\.cartocdn\.com/.test(url) || /\.(png|jpg|jpeg|webp)(\?|$)/.test(url);

// A GIS query must never be served from cache — stale ownership is worse than none.
const isLiveData = url =>
    /\/(MapServer|FeatureServer)\//i.test(url) || /\/rest\/services\//i.test(url);

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        /* Added one at a time, not via addAll: addAll rejects the whole install if a
           single CDN request fails, which would leave the app with no offline copy at
           all because one script 304'd oddly. Opaque no-cors responses are accepted
           as a fallback — they can't be inspected but they do replay offline. */
        await Promise.all(SHELL.map(async url => {
            try {
                const res = await fetch(url, { cache: 'reload' });
                if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res);
            } catch (e) {
                try {
                    const res = await fetch(url, { mode: 'no-cors' });
                    if (res) await cache.put(url, res);
                } catch (e2) { /* this asset just won't be available offline */ }
            }
        }));
        self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter(n => n.startsWith('field-map-') && n !== SHELL_CACHE && n !== TILE_CACHE)
            .map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

async function trimTiles() {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    if (keys.length <= MAX_TILES) return;
    // Cache API preserves insertion order, so the front of the list is the oldest.
    const excess = keys.length - MAX_TILES + TILE_TRIM;
    await Promise.all(keys.slice(0, excess).map(k => cache.delete(k)));
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = req.url;
    if (url.startsWith('chrome-extension:')) return;
    if (isLiveData(url)) return;                       // always straight to the network

    if (isTile(url)) {
        event.respondWith((async () => {
            const cache = await caches.open(TILE_CACHE);
            const hit = await cache.match(req);
            if (hit) {
                // Refresh quietly in the background; the driver gets the cached tile now.
                event.waitUntil((async () => {
                    try {
                        const fresh = await fetch(req);
                        if (fresh && (fresh.ok || fresh.type === 'opaque')) await cache.put(req, fresh.clone());
                    } catch (e) { /* offline — the cached tile stands */ }
                })());
                return hit;
            }
            try {
                const res = await fetch(req);
                if (res && (res.ok || res.type === 'opaque')) {
                    await cache.put(req, res.clone());
                    event.waitUntil(trimTiles());
                }
                return res;
            } catch (e) {
                return new Response('', { status: 504, statusText: 'Offline, tile not cached' });
            }
        })());
        return;
    }

    /* The page itself is NETWORK-FIRST, deliberately.

       Cache-first on index.html is how a service worker pins a device to an old
       build forever: the app keeps opening, looks perfectly healthy, and silently
       never picks up a deploy again. That is a nastier version of the stale-Pages
       failure this file was written after, because it would happen per-device with
       nothing on the server to point at.

       So when there is signal the newest page always wins, and the cache is the
       fallback for when there is not — which is the actual job it was added for. */
    const isPage = req.mode === 'navigate' ||
                   /\/(index\.html)?(\?|$)/.test(new URL(url).pathname + new URL(url).search);

    if (isPage) {
        event.respondWith((async () => {
            try {
                const res = await fetch(req, { cache: 'no-cache' });
                if (res && res.ok) {
                    const cache = await caches.open(SHELL_CACHE);
                    await cache.put('./index.html', res.clone());
                }
                return res;
            } catch (e) {
                const cached = (await caches.match(req)) || (await caches.match('./index.html'));
                if (cached) return cached;
                throw e;
            }
        })());
        return;
    }

    // Libraries: cache-first is safe — they are version-pinned in the URL itself.
    event.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
            const res = await fetch(req);
            if (res && (res.ok || res.type === 'opaque') && SHELL.some(s => url.endsWith(s.replace('./', '')))) {
                const cache = await caches.open(SHELL_CACHE);
                await cache.put(req, res.clone());
            }
            return res;
        } catch (e) {
            throw e;
        }
    })());
});

/* ---------- Messages from the page ---------- */
self.addEventListener('message', event => {
    const msg = event.data || {};

    if (msg.type === 'CACHE_TILES') {
        event.waitUntil((async () => {
            const cache = await caches.open(TILE_CACHE);
            let done = 0, failed = 0;
            // Sequential on purpose: hammering a tile CDN with hundreds of parallel
            // requests from a phone gets you rate-limited, not finished sooner.
            for (const url of msg.urls) {
                if (await cache.match(url)) { done++; continue; }
                try {
                    const res = await fetch(url, { mode: 'no-cors' });
                    if (res) { await cache.put(url, res); done++; } else { failed++; }
                } catch (e) { failed++; }
                if (done % 25 === 0) postAll({ type: 'CACHE_PROGRESS', done, total: msg.urls.length });
            }
            await trimTiles();
            postAll({ type: 'CACHE_DONE', done, failed, total: msg.urls.length });
        })());
    }

    if (msg.type === 'CACHE_STATUS') {
        event.waitUntil((async () => {
            const tiles = await caches.open(TILE_CACHE);
            const shell = await caches.open(SHELL_CACHE);
            postAll({
                type: 'CACHE_STATUS',
                tiles: (await tiles.keys()).length,
                shell: (await shell.keys()).length,
                max: MAX_TILES
            });
        })());
    }

    if (msg.type === 'CLEAR_TILES') {
        event.waitUntil((async () => {
            await caches.delete(TILE_CACHE);
            postAll({ type: 'CACHE_STATUS', tiles: 0, shell: -1, max: MAX_TILES });
        })());
    }
});

async function postAll(payload) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage(payload));
}
