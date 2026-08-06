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

**Touch-only target**: this app is used one-handed on a phone touchscreen during a live match —
optimize for tap targets, haptic feedback (`navigator.vibrate`), and portrait/landscape layout,
not keyboard or mouse interaction.
