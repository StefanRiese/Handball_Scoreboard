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

**Offline/installability**: a Service Worker is registered from an inline `Blob` URL (no separate
`sw.js` file) that caches the app shell for offline use; `manifest.json` + the
`apple-mobile-web-app-*` meta tags cover Android/Chrome and iOS install prompts respectively.
`navigator.wakeLock` keeps the screen on during a match, re-requested on `visibilitychange` since
the OS releases it when the tab backgrounds.

**Keep-awake fallback**: `navigator.wakeLock` is unreliable specifically in standalone ("Add to
Home Screen") contexts on iOS — confirmed on-device that it silently has no effect there even
though it works fine in a regular Safari tab. The `#keepawake` `<video>` element (muted,
`playsinline`, `loop`, tiny inline base64 `data:` URI — a 16×16px, 1-second, near-zero-bitrate
black clip generated with GStreamer, no external asset file) is the classic, more reliable
fallback: continuous media playback independently inhibits iOS's auto-lock timer. Controlled by
the `state.keepAwakeVideo` setting (Settings → Spielzeit → "Bildschirm wach halten"), following
the same persisted-toggle pattern as `showClock`/`whatsappEnabled`.

**Update flow — manual only, by design**: every request, including page navigation, is
cache-first (`caches.match(e.request).then(r=>r||fetch(e.request))`) — opening the app never
touches the network or triggers any update detection, on purpose (the user explicitly asked for
this; an earlier network-first-navigation design auto-checked on every open, which wasn't
wanted). The only way to get fresh content is the "🔄 Check for updates" button
(`checkForUpdates()`, Settings → Information): it fetches the live file with
`{cache: 'no-store'}` (bypassing both the SW cache and the browser's HTTP cache — necessary since
a `Cache-Control` header from the host, e.g. GitHub Pages' `max-age=600`, would otherwise silently
serve a stale copy), regex-extracts its embedded `APP_VERSION`, and only shows the update banner
if that differs from the running version. Confirming via `applyUpdate()` writes the
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
