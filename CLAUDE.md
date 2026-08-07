# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A handball scoreboard PWA for iPhone (and Android): two-team score tracking, a match clock, a
color/name picker, and a saved-game history — all client-side, no backend, no build step. See
README.md for the full user-facing feature list and deployment instructions (GitHub Pages).

## Repository layout

- `index.html` — the entire application (HTML + CSS + JS in one file). This is the only file you
  will normally need to edit.
- `manifest.json` — Web App Manifest for Android/Chrome install prompts.
- `handball_icon.png` — home-screen / manifest icon (1024×1024).
- `README.md` — user-facing feature docs (German).

There is intentionally no `src/`, no framework, and no bundler. Keep new code inside
`index.html` unless there's a strong reason to split it out — the project's whole premise is
"one file, no build tools."

## Commands

There is no build, lint, or test tooling in this repo (no `package.json`). To develop:

- **Preview locally**: serve the directory over HTTP (not `file://`, since the Service Worker and
  Wake Lock API require a proper origin) — e.g. `python3 -m http.server 8000` — then open
  `http://localhost:8000/index.html`.
- **Sanity-check JS syntax** (no linter configured): extract and parse the inline `<script>` block,
  e.g. `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`.
- **Deploy**: push `index.html`, `handball_icon.png`, and `manifest.json` to the repo root on
  `main`; GitHub Pages serves it directly (Settings → Pages → Deploy from branch → `main` / root).

## Architecture

Everything lives in one global `state` object (`index.html`), persisted to `localStorage` under
`STORAGE_KEY = 'handball_v3'` via `load()`/`save()`. There is no framework — UI updates are plain
DOM mutation functions called after every state change:

- `render()` — game view (scores, names, halftime badge, minus-button disabled state)
- `renderSettings()` — settings view (team name/color inputs, color swatches)
- `renderHistory()` — history view (saved games list, delete/clear-all confirmations)
- `renderClock()` / `applyClockVisible()` — match clock display and show/hide
- `applyLang()` — re-labels all static UI text after a language switch
- `applyTheme()` — toggles the `.light` class on `<body>` for the dark/light theme

Each `render*` function is idempotent and safe to call any time state changes — there's no
diffing or virtual DOM, just `textContent`/`style` assignment. When you add a new piece of state,
follow the existing pattern: mutate `state`, call the relevant `render*()`, then `save()`.

**i18n**: `I18N` holds `de`/`en` dictionaries; `t(key)` looks up the current `state.lang`. Every
piece of static or dynamic UI text should go through `t()` and be added to *both* language blocks.
`applyLang()` is the single place that re-applies all translated strings to the DOM — new
localized elements need a line there too.

**Match clock**: modeled as an absolute end timestamp (`state.clockEndsAt`), not a countdown
decremented on a tick — `tickClock()` (a 250ms `setInterval`) just recomputes
`clockRemaining = clockEndsAt - Date.now()`. This is what allows the clock to keep correct time
across tab backgrounding/`load()` on reopen (see the resume logic in `load()`, which checks
whether `clockEndsAt` is still in the future).

**Color contrast**: team colors are user-chosen (from `PRESETS`/`ALL_COLORS`, including
near-white/near-black entries) and used directly as text color for team name/score/history
digits. `readableColor()` (HSL round-trip via `hexToHsl`/`hslToHex`) clamps lightness against the
current theme's card background before using a color as *text* — swatches/dots keep the true
picked color. Any new UI that renders a team color as text should go through `readableColor()`,
not `state[t2].color` directly.

**Confirm-before-destructive-action pattern**: reset game, delete one history entry, and clear all
history each use the same link → Yes/No toggle pattern (a `pending*` module-level variable flips
which of two sibling `<div>`s is visible). Follow this pattern for any new destructive action
rather than `confirm()` dialogs or immediate deletion.

**Team identity vs. physical display slot**: `state.a`/`state.b` are fixed identities forever —
`state.a` is always Team 1, `state.b` always Team 2 (name, color, halves never move between
them). Game-view DOM ids (`disp-a`/`disp-b`, `name-a`/`name-b`, `hz-a`/`hz-b`, `corr-minus-a/b`,
`card-a`/`card-b`) are physically fixed too — `-a` is always the left card, `-b` always the right.
`state.team1OnLeft` is the only thing connecting the two: `identityForSlot(slot)` resolves which
identity currently renders in a given physical slot, and — since it's a plain flip, its own
inverse — also answers the reverse ("which slot currently shows this identity"), which
`setName()` needs since it's called with the identity (from the settings inputs, which always
edit Team 1/Team 2 directly) but must update the correctly-positioned DOM node. `swapTeams()`
only ever flips this one flag; it does not move any team data. Settings (`renderSettings()`,
`setName()`, `openColorModal()`) always operate on the fixed identity directly and are entirely
unaffected by `team1OnLeft` — only `render()`, `addGoal()`, and `correct()` (which receive a
physical slot from hardcoded HTML `onclick` attributes) need to resolve through
`identityForSlot()`. `saveGame()` always reads `state.a`/`state.b` directly for the same reason —
history naturally lists Team 1 first with no extra logic needed. Don't reintroduce data-swapping
in `swapTeams()`/`swapTeamsData()` — that was the prior design and was deliberately replaced with
this flag-only approach.

**Offline/installability**: a Service Worker is registered from an inline `Blob` URL (no separate
`sw.js` file) that caches the app shell for offline use; `manifest.json` + the
`apple-mobile-web-app-*` meta tags cover Android/Chrome and iOS install prompts respectively.
Two things caused offline home-screen launches to fail outright with the *browser's own*
"can't open the page" error (not anything this app could catch) — meaning the request never
reached the SW's fetch handler at all, or reached it but missed the cache lookup:
1. `.register()` had no explicit `scope` — for a `blob:` URL script the default scope is
   ambiguous, and if it doesn't end up covering the actual launch URL, the SW never intercepts
   that navigation. Fixed by passing `{ scope: swScope }` explicitly.
2. The install handler only cached one URL variant (the directory, `swScope`) — but a
   home-screen relaunch can request the explicit `index.html` URL instead depending on
   platform/iOS version, missing the cache-first lookup on an exact-URL mismatch. Also, neither
   `manifest.json` nor the icon were cached at all — iOS can refetch those for the installed
   app's own metadata independent of any page JS, and that same uncached-miss failure while
   offline is what actually surfaces as the OS's own "no internet, switch to Wi-Fi?" prompt
   (confirmed on-device), not just the browser's "can't open the page" error. Fixed by caching
   `swScope`, `swScope + 'index.html'`, `manifest.json`, and the icon, and by having
   `applyUpdate()` write the fetched HTML response under the shell URL variants too (not just
   `location.href`) so a manual update doesn't leave the URL a cold launch actually looks up
   stale even though the update "succeeded".
This self-heals on the next connected app open (SW re-registration runs unconditionally on every
load, not gated behind the manual update-check button) — no manual site-data reset needed for
this particular fix.
`navigator.wakeLock` keeps the screen on during a match. There were two real, confirmed root
causes of it failing on iOS standalone home-screen installs (found via WebKit's own bug tracker,
not guessed):

1. [webkit.org/b/254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — the Wake Lock API
   flat-out didn't work in Home Screen Web Apps at all (only in full Safari tabs) until Apple
   fixed it in **iOS/iPadOS 18.4** (shipped March 2025). No app-side code can work around this on
   older iOS — the only fix is updating iOS.
2. Even on 18.4+, WebKit requires **transient user activation** (a direct tap) to grant
   `navigator.wakeLock.request()` — a `visibilitychange` handler or a `setInterval` callback does
   NOT count as one, so a reacquisition attempt from either can silently fail with
   `NotAllowedError` (swallowed by our `catch {}`). This is why a periodic-retry-only approach is
   observed to help ("increases the time the display is awake") without being fully reliable.

Given #2, the retry strategy is layered, cheapest/least-reliable first: `visibilitychange` (async,
likely rejected per #2 but harmless to try), a 20s `setInterval` safety net (same caveat), and a
`touchstart` listener that reacquires whenever `!wl` — since this app has near-constant real taps
(scoring a goal, any button), and a genuine tap *does* carry transient activation, that listener
is the one actually likely to succeed. This is always on, unconditionally, with no settings
toggle — a keep-awake feature that can be silently switched off defeats its own purpose, so don't
reintroduce a `wakeLockEnabled`-style toggle for it without being asked. A muted-video-loop
fallback was tried and removed (commit reverting "Add keep-awake video fallback") after on-device
testing showed it did not prevent the OS auto-lock; NoSleep.js's own source only uses that trick
for pre-Wake-Lock-API browsers and relies on native Wake Lock
alone wherever it's available, which is why it was abandoned here too — don't re-add a
video/canvas/audio keep-awake hack without new evidence it actually helps.

**Update flow — manual only, by design**: every request, including page navigation, is
cache-first (`caches.match(e.request).then(r=>r||fetch(e.request))`) — opening the app never
touches the network or triggers any update detection, on purpose (the user explicitly asked for
this; an earlier network-first-navigation design auto-checked on every open, which wasn't
wanted). The only way to get fresh content is the "🔄 Check for updates" button
(`checkForUpdates()`, Settings → Information): it fetches the live file with a cache-busting
query string (`?_check=${Date.now()}`) AND `{cache: 'no-store'}`. Both are required, for two
different layers: `{cache: 'no-store'}` only bypasses the browser's own HTTP cache (needed since a
`Cache-Control` header from the host, e.g. GitHub Pages' `max-age=600`, would otherwise let the
browser silently reuse a stale response) — it does nothing about our Service Worker, whose fetch
handler is cache-first for every request regardless of the caller's `cache` option. Without the
query-string cache-bust, the SW would just re-serve whatever's already in Cache Storage (i.e. the
currently-running version) and the check would compare the running version against itself,
silently never detecting a real update. The query string exists purely to miss the SW's
`caches.match(e.request)` lookup so its own `r || fetch(e.request)` fallback actually reaches the
network — don't "simplify" this back to a plain `fetch(location.href, {cache:'no-store'})`, it
looks equivalent but reintroduces exactly this bug. It regex-extracts the response's embedded
`APP_VERSION`, and only shows the update banner if that differs from the running version.
Confirming via `applyUpdate()` writes the
already-fetched response (`pendingFreshResponse`) directly into every existing Cache Storage
entry keyed by the current URL, then reloads — the reload's cache-first lookup finds that
freshly-written entry immediately, so the new content shows without a second network round-trip.
Bump `APP_VERSION` (semver: `MAJOR.MINOR.PATCH`) on every deploy you want the button to be able to
detect — it's what the regex compares and what changes the embedded SW script's bytes (so a
subsequent normal page load still eventually installs the new SW's `install`/`activate`
lifecycle, e.g. to prune old-versioned caches). Do not reintroduce network-first navigation or an
automatic `updatefound` listener/banner — both were tried and explicitly reverted at the user's
request in favor of check-only-via-button. If reintroducing any automatic check, confirm with the
user first, since this has already been requested and removed once.

Earlier iteration note: a simpler version of the manual button just called `location.reload()`
unconditionally, which surfaced the browser's own "page not available" error when offline (no
cached fallback could satisfy the reload). Checking first — before ever attempting a reload —
avoids that.

**iOS home-screen quirk**: a standalone ("Add to Home Screen") PWA on iOS does not reliably run
the update-check flow on a cold app-switcher relaunch, even though the identical code works
correctly in a regular Safari tab — this is a platform limitation, not a bug in this app's logic.
The in-app "🔄 Check for updates" button works reliably from *within* the already-running
standalone instance (confirmed on-device) since it's a same-process JS reload rather than a fresh
WKWebView cold start; prefer that button over force-quitting/relaunching when debugging why an
installed icon seems stuck on an old version.

**Touch-only target**: this app is used one-handed on a phone touchscreen during a live match —
optimize for tap targets, haptic feedback (`navigator.vibrate`), and portrait/landscape layout,
not keyboard or mouse interaction.
