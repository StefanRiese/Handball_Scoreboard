// Service Worker for the Handball Scoreboard app — see CLAUDE.md's Service-Worker section for
// the full design rationale (cache-first fetch, static cache name, shell-fallback chain). This
// used to be generated as a minified template-literal string and registered from a Blob URL
// directly inside index.html's own <script> block; it now lives here as a real static file
// instead — registered via `navigator.serviceWorker.register('sw.js', ...)` — purely to make it
// independently readable/diffable, not a change in behavior. One side effect worth knowing:
// OFFLINE_HTML's embedded `<script>...</script>` no longer needs the escaped-slash trick that was
// required while this lived inside an HTML file's own <script> block (see CLAUDE.md's
// `</script>`-footgun paragraph) — this file is parsed as plain JS, not scanned by an HTML parser,
// so a literal closing-script-tag substring inside a JS string here is inert.

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
  <h1>Keine Internetverbindung<br/>No internet connection</h1>
  <p>Diese Seite ist offline noch nicht verfügbar.<br/>This page isn't available offline yet.</p>
  <button onclick="location.reload()">Erneut versuchen / Try again</button>
  <script>window.addEventListener('online', () => location.reload());</script>
</body></html>`;

// Install caches each shell URL independently (Promise.allSettled) rather than via
// cache.addAll(), which is all-or-nothing — a single flaky fetch would otherwise fail the ENTIRE
// install and leave nothing cached at all, not even the URLs that succeeded. SHELL[0]/SHELL[1]
// are the two page-shell URL variants (the directory and explicit index.html) — if fetching BOTH
// of those specifically failed, the install is rejected so the browser retries the whole install
// on the next online register() call; a manifest/icon-only failure is not fatal since the app
// still works offline without those.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u =>
        fetch(u).then(r => { if (!r.ok) throw new Error('bad status'); return c.put(u, r); })
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
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request).catch(async () => {
      if (event.request.mode !== 'navigate') throw new Error('offline');
      const shellFallback = (await caches.match(SHELL[1])) || (await caches.match(SHELL[0]));
      if (shellFallback) return shellFallback;
      return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }))
  );
});
