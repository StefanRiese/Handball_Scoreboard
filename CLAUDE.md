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

**Per-entry toggle-view pattern (history cards)**: delete (`pendingDeleteId`), edit
(`pendingEditId`), the share menu (`pendingShareId`), and the scorers panel
(`pendingScorersId`) are four mutually-exclusive per-entry states in `renderHistory()` — every
`ask*`/`toggle*` setter that opens one explicitly nulls the other three, and `showView('history')`
clears all four on tab switch. Delete/edit/share replace the entry's action row (📤/✏️/✕) with
their own panel; the scorers panel is the exception — it's non-destructive and shown *alongside*
the action row (`entryActions`'s condition excludes only `isPending`/`isEditing`/`isSharing`, not
`isViewingScorers`) so the 👕 button stays visible to toggle it back off. Follow this exclusion
list when adding a fifth per-entry view rather than inventing a separate mechanism.

**Team identity vs. physical display slot**: `state.a`/`state.b` are fixed identities forever —
`state.a` is always Team 1, `state.b` always Team 2 (name, color, halves never move between
them). Game-view DOM ids (`disp-a`/`disp-b`, `name-a`/`name-b`, `hz-a`/`hz-b`, `corr-minus-a/b`,
`card-a`/`card-b`) are physically fixed too — `-a` is always the left card, `-b` always the right.
`state.team1OnLeft` is the only thing connecting the two: `identityForSlot(slot)` resolves which
identity currently renders in a given physical slot, and — since it's a plain flip, its own
inverse — also answers the reverse ("which slot currently shows this identity"), which
`setName()` needs since it's called with the identity but must update the correctly-positioned
game-view DOM node. `swapTeams()` only ever flips this one flag; it does not move any team data.
`saveGame()` always reads `state.a`/`state.b` directly for the same reason — history naturally
lists Team 1 first with no extra logic needed. Don't reintroduce data-swapping in
`swapTeams()`/`swapTeamsData()` — that was the prior design and was deliberately replaced with
this flag-only approach.

The settings screen's team sections (`set-section-a`/`set-section-b` and everything inside them)
are physical slots too, same as the game view — `set-section-a` is always the left column. This
is so the settings layout visually tracks `swapTeams()`: whichever team is showing on the left in
the game view also shows on the left in Settings. `renderSettings()` resolves
`identityForSlot(slot)` per slot on every render and populates that slot's name input, color
swatches, and title from that identity — including reassigning the name input's `oninput` handler
each render (`nameInput.oninput = () => setName(t2, nameInput.value)`), since which identity a
slot edits can change after a swap. `openColorModal(t2)` and the color-dot/`+` button `onclick`s
are likewise bound to the resolved identity per render, not to a fixed slot. `swapTeams()` calls
both `render()` and `renderSettings()` since the swap button lives on the Settings tab and the
settings view needs to reflect the flip immediately, not just on next tab switch.

**History entry shape**: `state.history` entries are `{ id, date, time, teams: [teamA, teamB] }`,
where each `teamN` is `{ name, score, color, halftimeScore, scorers }`. `halftimeScore` and
`scorers` live per-team (not in a separate top-level object) so every consumer — `renderHistory()`,
`gameShareText()`, JSON export (`exportHistory()`, which just serializes `state.history` as-is) —
reads from one place. There is deliberately no migration path for the pre-existing older shape
(a separate top-level `ht: {a,b}`, and no `scorers` at all) since the app has no real users yet;
don't add back a migration in `load()` without checking whether that's still true.

**Player-number tracking**: `state.trackPlayerNumbers` (Settings → Tore/Goals, default off) and
`state.scorers = { a: [], b: [] }` (flat arrays of `{ half, number }` in scoring order per
identity, `number` is `null` when skipped) are the live-game equivalents of `teams[i].scorers`
persisted at `saveGame()` / cleared at `saveGame()`/`resetGame()`. `addGoal()` always increments
the score and calls `save()`/`render()` immediately regardless of the setting — a fast tap during
a live match must never be blocked on the keypad popup — then, only if the setting is on, opens
`openPlayerNumberModal(identity)`. That modal's keypad (`pressDigit`/`pressBackspace`) writes into
module-level `playerNumberInput`; confirming or skipping both funnel through `recordScorer()`,
which is the only place that pushes into `state.scorers[identity]` and closes the modal — tapping
outside the modal is wired to `skipPlayerNumber()` for the same effect. `correct()` (the minus
button) pops the last entry off `state.scorers[identity]` whenever the log has more entries than
the current goal total, keeping the two in sync even if tracking was toggled on/off mid-match
rather than gating the pop on the current setting value.

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
This self-heals on the next connected app open — no manual site-data reset needed for this
particular fix.

**SW registration only happens while online** (`navigator.onLine` guard around the whole
`if ('serviceWorker' in navigator)` block). The SW's `CACHE` name is a static string
(`'handball-shell'`) rather than `handball-v${APP_VERSION}` — it used to be version-derived, but
that made the SW script itself byte-differ on every content-only version bump, which made the
browser silently install (and, on the app's next open, activate — deleting the old cache) the new
SW version in the background regardless of the manual "🔄 Check for updates" button, i.e. an
unwanted auto-update the user never asked for. With a static name, a plain `APP_VERSION` bump for
a content/feature change no longer touches the SW script at all, so `.register()` finds it
byte-identical and does nothing — content updates only ever happen through `applyUpdate()`
explicitly writing into the existing cache. The SW script (and therefore a real reinstall) only
changes when this install/activate/fetch logic itself is edited, or `shellUrls` changes — in that
case the browser does still try to install the new version on every open, which requires fetching
the shell/manifest/icon fresh over the network: if that first post-deploy open happens to be
offline, the install fails and retries on *every* subsequent open until it finally succeeds
online, and each failed attempt can trigger the OS's own "no internet, switch to Wi-Fi/turn off
airplane mode?" prompt (confirmed on-device — this is a different symptom from the "can't open
the page" error above, but the same underlying cause: a network attempt that shouldn't have
happened). Skipping registration entirely while offline leaves whatever SW is already active
(already fully cached from a prior online visit) in control with zero network attempts. Don't
reintroduce a version-derived cache name — that's exactly the silent-auto-update behavior this was
changed to avoid.
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

**Design tokens**: corner radii and spacing are CSS custom properties on `:root` —
`--radius-sm/md/lg` (12/16/22px) and `--space-1..5` (4/8/12/16/24px). New `border-radius`/`gap`/
`padding`/`margin` values should reuse one of these rather than introducing another one-off px
value; values that don't cleanly fit the scale (there are still some, e.g. 14px/18px/20px) were
deliberately left as literals rather than forced onto the scale and changing visual sizing.
`state.cardAccentEnabled` (Settings → Darstellung/Appearance, default on) gates the radial-gradient
team-color accent that `render()` applies to `card-a`/`card-b`'s `background` — when off it falls
back to plain `var(--card)`. `.team-score.pulse` (a `scorePulse` keyframe) is toggled in `render()`
only when a slot's score text actually changes (compared before overwriting `textContent`), not on
every `render()` call, so it doesn't fire on unrelated state changes (e.g. a settings edit).
`:focus-visible` styling is one global rule (`button, input, [tabindex]`) — don't add
element-specific `:focus-visible` rules again (there used to be a `.color-dot`-only one).

**Touch-only target**: this app is used one-handed on a phone touchscreen during a live match —
optimize for tap targets, haptic feedback (`navigator.vibrate`), and portrait/landscape layout,
not keyboard or mouse interaction.
