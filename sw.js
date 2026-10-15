// Handball Scoreboard — Copyright (c) 2026 Stefan Riese — MIT License
// https://github.com/StefanRiese/Handball_Scoreboard
//
// Service Worker for the Handball Scoreboard app, registered from index.html — see CLAUDE.md's
// Offline/installability section for the design rationale (cache-first fetch, static cache name,
// shell-fallback chain).

const CACHE = 'handball-shell';

// This file (sw.js) sits alongside index.html in this app's own folder, so its own location gives
// the same directory swScope in index.html computes — no need for index.html to pass it in.
const SCOPE = new URL('./', self.location).pathname;
const SHELL = [SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.json', SCOPE + 'handball_icon.png'];

// Shown for a navigation that's neither in Cache Storage nor reachable over the network —
// replaces the browser's own generic connection-error page with something on-brand that at least
// offers a retry, following the "offline fallback page" pattern from
// https://web.dev/articles/offline-fallback-page (same fix applied to the sibling PWA-games
// launcher). This is only the last-resort fallback — the fetch handler below tries the cached
// shell itself first, since that's always cached (SHELL[0]/SHELL[1], the two entries install()
// fails hard on) and is fully functional, unlike this static page.
const OFFLINE_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Offline</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:#0b0c0f; color:#eef0f3; font-family:-apple-system,BlinkMacSystemFont,sans-serif; text-align:center; padding:24px; box-sizing:border-box; }
  .icon { font-size:48px; }
  h1 { font-size:18px; margin:0; font-weight:600; }
  p { margin:0; color:#8d94a1; font-size:14px; }
  button { margin-top:8px; padding:12px 28px; border-radius:10px; background:#2563eb; color:#fff; border:0; font-size:15px; font-weight:600; }
  button:active { filter:brightness(0.85); }
</style></head>
<body>
  <div class="icon">🤾</div>
  <h1>Keine Internetverbindung<br/>No internet connection<br/>Sin conexión a internet</h1>
  <p>Diese Seite ist offline noch nicht verfügbar.<br/>This page isn't available offline yet.<br/>Esta página aún no está disponible sin conexión.</p>
  <button onclick="location.reload()">Erneut versuchen / Try again / Reintentar</button>
  <script>window.addEventListener('online', () => location.reload());</script>
</body></html>`;

// Install caches each shell URL independently (Promise.allSettled) rather than via
// cache.addAll(), which is all-or-nothing — a single flaky fetch would otherwise fail the ENTIRE
// install and leave nothing cached at all, not even the URLs that succeeded. SHELL[0]/SHELL[1]
// are the two page-shell URL variants (the directory and explicit index.html) — if fetching BOTH
// of those specifically failed, the install is rejected so the browser retries the whole install
// on the next online register() call; a manifest/icon-only failure is not fatal since the app
// still works offline without those.
// skipWaiting(): a changed sw.js activates as soon as it's installed instead of waiting until every
// window of the app is closed — iOS keeps a home-screen PWA alive in the background for long
// stretches, and a reload doesn't count as closing, so SW fixes could otherwise take days to land.
// Safe here since every version shares the one CACHE and its fetch handler only reads from it.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u =>
        // cache:'reload' — fetch from the network, not the browser's HTTP cache (GitHub Pages sets
        // max-age=600), so a fresh install can't cache an index.html that predates the deploy.
        fetch(u, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error('bad status'); return c.put(u, r); })
      )))
      .then(rs => {
        if (rs[0].status === 'rejected' && rs[1].status === 'rejected') {
          throw new Error('shell cache install failed');
        }
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    const isNavigate = event.request.mode === 'navigate';
    // Navigations get an explicit Cache-Control: no-store on the response itself (not just the
    // outgoing request), applied uniformly whether the response came from Cache Storage or a live
    // fetch — a no-store *request* alone still let iOS Safari's back-forward cache (bfcache)
    // restore a fully-rendered snapshot of a page from a previous visit without ever hitting this
    // fetch handler again on the next visit, which would silently hide a since-refreshed cache
    // entry (e.g. after checkForUpdates() writes a newer page into Cache Storage) behind a stale
    // bfcache snapshot. A no-store response header opts the page out of bfcache eligibility so
    // every visit re-runs this handler and sees the current cache state.
    const stampNoStore = res => {
      if (!isNavigate) return res;
      const headers = new Headers(res.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    };
    const cached = await caches.match(event.request);
    if (cached) return stampNoStore(cached);
    try {
      // cache:'no-store' bypasses the *browser's* own HTTP cache, which otherwise still silently
      // re-serves stale bytes regardless of any SW-level caching.
      const res = await fetch(event.request, { cache: 'no-store' });
      return stampNoStore(res);
    } catch (err) {
      if (isNavigate) {
        const shellFallback = (await caches.match(SHELL[1])) || (await caches.match(SHELL[0]));
        if (shellFallback) return stampNoStore(shellFallback);
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
        });
      }
      throw err;
    }
  })());
});
