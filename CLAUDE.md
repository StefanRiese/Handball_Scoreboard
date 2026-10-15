# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A handball scoreboard PWA for iPhone (and Android): two-team score tracking, a match clock, a
color/name picker, and a saved-game history — all client-side, no backend, no build step. See
README.md for the full user-facing feature list and deployment instructions (GitHub Pages).

## Repository layout

- `index.html` — the entire application (HTML + CSS + JS in one file). This is the file you will
  normally need to edit most.
- `sw.js` — the Service Worker (see "Offline/installability" below), registered by `index.html` via
  `navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope })`. A plain static file,
  not a build artifact — edit it directly like any other file in this repo.
- `manifest.json` — Web App Manifest for Android/Chrome install prompts.
- `handball_icon.png` — home-screen / manifest icon (512×512, matching `manifest.json`).
- `README.md` — user-facing feature docs (German).
- `package.json`, `eslint.config.mjs`, `test/`, `.github/workflows/ci.yml` — dev-only lint/test tooling and CI (see Commands).

There is intentionally no `src/`, no framework, and no bundler. Keep new code inside
`index.html` unless there's a strong reason to split it out — the project's whole premise is
"one file, no build tools."

## Commands

There is no build tooling. `package.json` exists only for dev-time lint/tests (its devDependencies
never ship — the app itself still has zero runtime dependencies). To develop:

- **Lint**: `npm run lint` — ESLint (`eslint.config.mjs`, `js.configs.recommended`) over
  `index.html`'s inline script (via `eslint-plugin-html`), `sw.js` and `test/`. `no-unused-vars`
  only checks locals in `index.html`, since top-level functions are called from inline `onclick`
  attributes ESLint can't see; empty `catch {}` blocks are allowed (deliberate best-effort calls).

- **Test**: `npm ci` once, then `npm test` (Node ≥ 22, built-in `node:test` runner). CI
  (`.github/workflows/ci.yml`) runs `npm run lint` and `npm test` on every push to `main` and every PR.
  - `test/helpers.js` `bootApp({ stored })` loads the real `index.html` in jsdom (optionally
    pre-seeding localStorage), with network/canvas/`matchMedia` stubbed; `ctx.app.<name>` reads
    any top-level binding (incl. `let`/`const` like `state`, `revertWindow`) via `window.eval`.
    Uncaught page errors are collected in `ctx.errors` and fail the test. Objects from the page
    are another realm — pass them through `plain()` (JSON round-trip) before `deepEqual`.
  - `test/app.test.js` — behavior (goals, scorers, halftime swap, history, clock, load/save).
  - `test/sw.test.js` — runs `sw.js` in a `vm` with an in-memory Cache Storage and fake `fetch`.
  - `test/static.test.js` — syntax of both scripts, `APP_VERSION` format, manifest/icon, SW shell files.
  - New behavior in `index.html` should come with a test in `test/app.test.js`.
- **Preview locally**: serve the directory over HTTP (not `file://`, since the Service Worker and
  Wake Lock API require a proper origin) — e.g. `python3 -m http.server 8000` — then open
  `http://localhost:8000/index.html`.
- **Sanity-check JS syntax** (without installing anything; `npm run lint` covers this too): `sw.js` is a plain `.js` file, so
  `node -e "new Function(require('fs').readFileSync('sw.js','utf8'))"` parses it directly — no
  extraction needed, unlike `index.html`, which embeds its JS inside an HTML `<script>` block:
  extract and parse that instead, e.g.
  `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`.
- **Deploy**: push `index.html`, `sw.js`, `handball_icon.png`, and `manifest.json` to the repo root
  on `main`; GitHub Pages serves it directly (Settings → Pages → Deploy from branch → `main` / root).

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
whether `clockEndsAt` is still in the future). Remaining seconds are `Math.ceil`'d (not rounded),
so the display reads 30:00 until a full second has passed and the half ends exactly at 0, not
~0.5s early. `stopClock()` also stashes the exact remaining ms in module-level `clockPausedMs`,
which `startClock()` resumes from (only while `ceil(clockPausedMs/1000)` still equals
`clockRemaining` — any other path that changed `clockRemaining` implicitly invalidates it), so
repeated pause/resume doesn't drift. `onClockEnd()` (live tick only — `load()`'s replay of a
half that ended while closed is silent) signals the end of a half with `navigator.vibrate` (Android;
iOS has no Vibration API) plus a ~3s blink of the clock display (`.clock-display.ended`).

The half-length and revert-window number inputs apply valid values on every keystroke
(`clampNumberInput()`, which leaves an empty field alone mid-edit); on blur an empty field is
refilled with the current `state` value rather than a hardcoded minimum.

**Color contrast**: team colors are user-chosen (from `PRESETS`/`ALL_COLORS`, including
near-white/near-black entries) and used directly as text color for team name/score/history
digits. `readableColor()` (HSL round-trip via `hexToHsl`/`hslToHex`) clamps lightness against the
current theme's card background before using a color as *text* — swatches/dots keep the true
picked color. Any new UI that renders a team color as text should go through `readableColor()`,
not `state[t2].color` directly.

**Confirm-before-destructive-action pattern**: reset game, reset clock (↻), delete one history
entry, clear all history, and reset all settings to default (`confirmResetSettings()`, Settings → the merged
"Allgemein"/"General" section) each use the same link → Yes/No toggle pattern. Reset game and
reset settings use direct `style.display` toggles on sibling `<div>`s (no `pending*` variable);
delete/clear-all history use a `pending*` module-level variable instead since multiple history
entries share one confirm area and need to know *which* entry/whether "all". Follow whichever
sub-pattern fits (single fixed action → direct toggle; one-of-many entries → `pending*` id) rather
than `confirm()` dialogs or immediate deletion. The game view has three confirmations — reset game
(`reset-confirm-area`), finish game (`finish-confirm-area`) and reset clock
(`clock-reset-confirm-area`, below the clock row; `askClockReset()` skips it when the clock is
already at the untouched full length) — and they are mutually exclusive: each `ask*()` calls
`closeGameConfirms()` first, and `showView()` calls it when navigating away from the Game tab, the
same way Settings/History clear their own pending confirmations on tab switch.
`saveGame()`/`resetGame()` and hiding the clock also close the clock-reset one.

**Per-entry toggle-view pattern (history cards)**: delete (`pendingDeleteId`), edit
(`pendingEditId`), the share menu (`pendingShareId`), and the scorers panel
(`pendingScorersId`) are four mutually-exclusive per-entry states in `renderHistory()` — every
`ask*`/`toggle*` setter that opens one explicitly nulls the other three, and `showView('history')`
clears all four on tab switch. Delete/edit/share replace the entry's action row (📤/✏️/✕) with
their own panel; the scorers panel is the exception — it's non-destructive and shown *alongside*
the action row (`entryActions`'s condition excludes only `isPending`/`isEditing`/`isSharing`, not
`isViewingScorers`) so the 🥅 button stays visible to toggle it back off. Follow this exclusion
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

Every change of `state.half` goes through `changeHalf(h)` (`setHalf()`, `onClockEnd()`, `load()`'s
missed-halftime replay, `resetGame()`, `saveGame()`). Entering half 1 swaps sides if
`autoSwapAtHalftime` is on and records that in `state.halftimeSwapped` (persisted live-match
state, not a setting); returning to half 0 undoes the swap only if that flag is set. This keeps
reset/finish from leaving the next game on swapped sides, and from flipping the wrong way if the
setting was toggled mid-match. `confirmResetSettings()` clears the flag since it forces
`team1OnLeft` back to the default.
`saveGame()` always reads `state.a`/`state.b` directly for the same reason — history naturally
lists Team 1 first with no extra logic needed. Don't reintroduce data-swapping in
`swapTeams()`/`swapTeamsData()` instead of the flag-only approach.

The settings screen's team sections (`set-section-a`/`set-section-b` and everything inside them)
are physical slots too, same as the game view — `set-section-a` is always the left column. This
is so the settings layout visually tracks `swapTeams()`: whichever team is showing on the left in
the game view also shows on the left in Settings. `renderSettings()` resolves
`identityForSlot(slot)` per slot on every render and populates that slot's name input, color
swatches, and title from that identity — including reassigning the name input's `oninput` handler
each render (`nameInput.oninput = () => { setName(t2, nameInput.value); autoGrowNameInput(nameInput); }`), since which identity a slot edits can change after a swap. The name field is a
`<textarea rows="1">`, not an `<input>`, so a long team name wraps onto a second line instead of
scrolling horizontally — `autoGrowNameInput(el)` (reset height to `auto`, then set it to
`scrollHeight`) grows the box to fit on every keystroke and on initial render, since a `<textarea>`
doesn't do this on its own. `onkeydown` still intercepts Enter and blurs instead of inserting a
newline — team names wrap visually but still can't contain a literal line break.
`openColorModal(t2)` and the color-dot/`+` button `onclick`s
are likewise bound to the resolved identity per render, not to a fixed slot. `swapTeams()` calls
both `render()` and `renderSettings()` since the swap button lives on the Settings tab and the
settings view needs to reflect the flip immediately, not just on next tab switch.

**History entry shape**: `state.history` entries are `{ id, date, time, teams: [teamA, teamB] }`,
kept newest-first (`saveGame()` unshifts; `saveEditGame()` re-sorts by `id` descending when an edit
changes the date/time, since `id` doubles as the game's timestamp),
where each `teamN` is `{ name, score, color, halftimeScore, scorers }`. `halftimeScore` and
`scorers` live per-team (not in a separate top-level object) so every consumer — `renderHistory()`,
`gameShareText()`, JSON export (`exportHistory()`, which just serializes `state.history` as-is) —
reads from one place. There is no migration path for older/legacy history shapes; the app has no
real users yet, so don't add one without checking whether that's still true. `exportHistory()`
defers its `URL.revokeObjectURL()` by 1s after `a.click()` rather than calling it synchronously —
older iOS Safari can still be asynchronously reading the blob to hand off to the download/share
sheet at that point, and revoking immediately risked an empty or truncated exported file.

**Display name vs. stored name**: `state[identity].name` is kept as the raw (possibly empty)
string the user typed — `displayNameFor(identity)` is the single place that falls back to the
`t('team1')`/`t('team2')` placeholder when it's blank, computed fresh on every call rather than
baked into `state` (so it re-localizes correctly on a language switch). `render()`,
`renderGoalsView()`, the player-number modal title, and `saveGame()`'s persisted history entry all
go through it. Settings' own name `<input>` is the one exception and always shows the raw value,
since it's an editable field, not a display — don't route it through `displayNameFor()` too, or
clearing the field to type a new name would fight the placeholder mid-edit. `load()` restores
`state.a.name`/`state.b.name` with a `typeof p.a.name === 'string'` check, not a truthy check — a
truthy check would treat an intentionally-cleared (empty-string) name as absent and silently
revert it to the hardcoded initial default on the next app open.

**Player-number tracking**: `state.trackPlayerNumbers` (Settings → Tore/Goals, default **on**) and
`state.scorers = { a: [], b: [] }` (flat arrays of `{ half, number, pos, globalPos }` in scoring
order per identity) are the live-game equivalents of `teams[i].scorers` persisted at `saveGame()` /
cleared at `saveGame()`/`resetGame()`. `number` is kept as the **raw typed string** (e.g. `"03"`,
`"00"`); it's `null` when skipped. `scorerTally()` (used by every scorer-display consumer)
normalizes leading zeros when counting (`String(Number(n))`, so `"03"` and `"3"` are the same
player, `"00"` is `"0"`) — done there rather than at entry so already-saved history entries
holding the raw string tally correctly too.
`scorerTableRows(tally)` turns a tally into the `<tr>` rows shared by both scorer-table renderers —
the live goals view (`renderGoalsView()`'s `teamBlock()`) and the saved-history scorers panel
(`renderHistory()`'s `scorerRows()`/`scorerBlock()`) — so a future change to the row markup (e.g. a
new column) only needs to happen once.

`addGoal()` always increments the score and calls `save()`/`render()` immediately regardless of
the setting — a fast tap during a live match must never be blocked on the keypad popup — then,
only if the setting is on, opens `openPlayerNumberModal(identity, half, pos, globalPos)`, where
`half` is `state.half` *at the moment the goal was scored* (not read again later) and:
- `pos` is the goal's 1-indexed position **within that half's own count** — `state.halves[identity][half]` right after incrementing it. `correct()` (the minus button) stamps the same
  `(half, pos)` for the goal it's about to undo (from `state.halves[identity][state.half]` before
  decrementing) and removes the scorer-log entry matching that exact pair, if any — scoped to the
  half because the minus button always decrements whichever half is *currently selected*, which
  can differ from the half the most-recently-scored goal was actually in if the user switched
  halves manually since then. No match means the undone goal was never tracked, so nothing to
  remove.
- `globalPos` is the goal's 1-indexed position **across both halves combined** (`total(identity)`
  after incrementing) — used only by `saveEditGame()`'s scorer-log trim when an edited-down final
  score needs to drop entries: it filters by `entry.globalPos <= newScore` rather than slicing the
  array by index, since the scorers array is a chronological *subsequence* of all goals (not
  necessarily a prefix) whenever tracking started mid-match. Falls back to index-based `slice()`
  only if any entry lacks `globalPos` (older data).

The modal's keypad (`pressDigit`/`pressBackspace`) writes into module-level `playerNumberInput`;
confirming or skipping both funnel through `recordScorer()`, which is the only place that pushes
into `state.scorers[identity]` and closes the modal — tapping the modal's backdrop is wired to
`skipPlayerNumber()` for the same effect. The modal covers the whole screen the instant it opens,
so the second tap of a fast double-tap on a team card lands on the modal, not the card: a
capture-phase click listener on `#player-modal` swallows any tap within
`PLAYER_MODAL_TAP_GUARD_MS` (350ms) of `playerModalOpenedAt` (so it can't skip or type a stray
digit) and, if a team card is under it (`elementsFromPoint`), forwards it to `addGoal()` as the
goal it was meant to be — but only when the modal was opened straight from a card tap
(`playerModalOpenedByCardTap`); a modal opened from the queue right after ✓ swallows the tap
without forwarding, since the preceding tap was on the modal, not a card. The mirror-image guard
runs after the modal closes: a document-level capture click listener swallows any tap within the
same window after `playerModalClosedAt`, so a double-tap on ✓/Skip can't reach whatever lies
underneath (a team card → phantom goal, the half button → half switch and side swap). The
card-tap forwarding is the path that fills `playerNumberQueue` (an array of
`{identity, half, pos, globalPos}`) — a goal scored while the modal is open is queued rather than
overwriting the still-open modal's state, and `recordScorer()` drains the next queued entry after
closing. `resetGame()` and
`saveGame()` both clear the queue and any still-open modal, since a pending entry from the
finished/discarded game would otherwise record against the next game's just-reset `state.scorers`.

`openPlayerNumberModal()` also tints `#player-modal-box` with the scoring identity's color via
`applyTeamColorAccent(el, color)` — the same helper `render()` uses for `card-a`/`card-b` and
`renderSettings()` uses for `set-section-a`/`set-section-b`, so all three surfaces share one
formula instead of three copies. `background` (the radial gradient) respects `cardAccentEnabled`;
`boxShadow`'s inset border does not — that toggle only ever controlled the gradient fill. Route any
new team-color-accented surface through this helper rather than re-deriving the gradient/shadow
strings again. Similarly, `createColorSwatchButton(color, selected, onClick)` is the one place that
builds a circular color-swatch `<button>` (background, selected border/box-shadow,
aria-label/aria-pressed) — used by both the Settings preset-color row (`renderSettings()`, sized by
the `.color-dot` CSS class's fixed 30px) and the full color-picker modal grid
(`openColorModal()`, which overrides `width`/`height`/`aspect-ratio` afterward so each swatch fills
its grid column instead of a fixed size). Route any new color-swatch UI through this helper too.

**Single-revert mode**: `state.singleRevertMode` (Settings → Tore, default off) and
`state.singleRevertSeconds` (default 30, adjustable 1–300) change what the minus button (the same
physical `corr-minus-a`/`corr-minus-b` button, no separate UI element) does after a goal — instead
of always being available to decrement whichever half is currently selected (the normal-mode
behavior, unlimited undos), it becomes a ↺ "revert" icon that's only *visible* (not just
disabled — `render()` sets `display:none` outside the window, since a dead-looking always-present
control would misleadingly imply an undo that no longer exists) for `singleRevertSeconds` after the
goal it would undo, and can only revert that one goal once.

The per-identity window lives in module-level `revertWindow = { a: null, b: null }` (`{ until,
half }` or `null`) — ephemeral, not part of persisted `state`, same tradeoff as
`playerNumberQueue`. `addGoal()` calls `openRevertWindow(identity, half)` when the mode is on,
which replaces any still-open window for that identity (a second goal scored inside the first
goal's window retargets the revert to the *new* goal rather than leaving both racing on the old
timer) and schedules a `setTimeout` to close it and `render()` when the window naturally expires.
`correct()` closes the window itself (`closeRevertWindow(identity)`) immediately after a successful
revert — that's the actual enforcement of "only one revert per team," not a counter, since the UI
can't offer a second tap once the window is closed. Storing `half` in the window (not just reading
`state.half` when the button is pressed) matters because the user can switch halves manually while
the window is still open; `correct()` special-cases this — when `singleRevertMode` is on and `d<0`,
it uses `revertWindow[identity].half` instead of `state.half`, so the revert still hits the half
the goal actually belongs to rather than whatever half happens to be selected at tap time. The
plain minus button (mode off) is untouched — always acts on `state.half`, as before.
`resetGame()`/`saveGame()`/`confirmResetSettings()` all call `closeRevertWindow()` for both
identities, so a window opened by the finished/discarded game's last goal can't apply to the next
one.

**Reset to default settings**: `DEFAULT_SETTINGS` (a standalone literal, not derived from the
mutable `state` object) mirrors the *initial* values of `state`'s Settings-tab fields — team
names/colors, `darkMode`, `lang`, `showClock`, `team1OnLeft`,
`autoSwapAtHalftime`, `halfLength`, `trackPlayerNumbers`, `cardAccentEnabled`,
`singleRevertMode`, `singleRevertSeconds`, `showScoreFactor` — and is what
`confirmResetSettings()` (Settings → "Allgemein"/"General", via `askResetSettings()`'s Yes/No
confirm) restores. Deliberately excludes `half`/`halves`/`history`/`clockRemaining`/
`clockRunning`/`clockEndsAt`/`scorers`/`halftimeSwapped` — those are live match/history state, not settings, and
already have their own separate "Reset game"/"Clear history" actions; don't fold them into this
one. Keep `DEFAULT_SETTINGS` in sync by hand whenever `state`'s own initial literal changes — there
is no single source of truth between them since `state` mutates at runtime and can't be read back
from later. The General section also absorbed the old separate "Information" section (version,
developer, license link, QR code, share-app, add-to-home-screen) — don't re-split it without being asked.

**Offline/installability**: the Service Worker lives in `sw.js`, a real static file alongside
`index.html`, registered via `navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope
})`. `swScope` is `sw.js`'s own directory — this file sits alongside `index.html` at the app root,
so no explicit scope needs to be passed in beyond what's already there. It caches the app shell for
offline use; `manifest.json` + the `apple-mobile-web-app-*` meta tags cover Android/Chrome and iOS
install prompts respectively.

`CACHE` (`'handball-shell'`) is a static string, not version-derived — content updates never touch
the SW script itself, they go through `checkForUpdates()` writing straight into the
existing cache (see below). The SW script only changes, and therefore only reinstalls, when this
install/activate/fetch logic itself is edited or `SHELL` changes. Don't make `CACHE` derive from
`APP_VERSION` — that causes the SW to silently reinstall on every content-only version bump,
independent of the update flow.

`SHELL` is `[SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.json', SCOPE + 'handball_icon.png']` —
both the directory and the explicit `index.html` URL are cached (a home-screen relaunch can request
either depending on platform), plus the manifest and icon (iOS can refetch those independently of
any page JS for the installed app's own metadata).

- **`install`**: calls `self.skipWaiting()` first, so a changed `sw.js` activates as soon as it's
  installed instead of waiting until every window of the app is closed (iOS keeps a home-screen PWA
  alive for long stretches, and a reload doesn't count) — safe since every version shares the one
  `CACHE`. Caches each `SHELL` URL independently via `Promise.allSettled` (not
  `cache.addAll()`, which is all-or-nothing) so one flaky fetch can't wipe out the others. Each
  fetch throws on `!r.ok` so a transient HTTP error doesn't get cached as if it were the real file.
  Fetches use `{ cache: 'reload' }` so a fresh install can't pick up a pre-deploy copy from the
  browser's HTTP cache (GitHub Pages sets `max-age=600`). Install only fails (rejecting so the browser retries on the next online `register()`) if fetching
  **both** `SHELL[0]` and `SHELL[1]` — the two page-shell URL variants — failed; a manifest/icon-only
  failure is left non-fatal since the app still works offline without those two.
- **`activate`**: deletes every cache except the current `CACHE`, then calls `self.clients.claim()`
  so a freshly-activated SW takes control of already-open tabs immediately instead of waiting for
  their next reload.
- **`fetch`**: cache-first (`caches.match(event.request)`). A cache miss falls through to a live
  network fetch with `{ cache: 'no-store' }` (bypasses the *browser's* own HTTP cache, not just
  Cache Storage). Every navigation response — cached or freshly fetched — gets `Cache-Control:
  no-store` stamped onto it via `stampNoStore()` before being returned, which opts the page out of
  bfcache eligibility; without this, iOS Safari's back-forward cache can restore a stale
  full-page snapshot without ever re-entering this fetch handler, hiding a since-refreshed Cache
  Storage entry (e.g. right after `checkForUpdates()` writes a newer page into the cache). If the
  network fetch throws (genuinely offline, nothing cached) and the request is a navigation, it
  falls back to the cached shell itself (`SHELL[1]` then `SHELL[0]`, always populated since those
  are the two entries `install()` fails hard on) — fully functional, lets the user get back into
  the app — and only as a last resort to `OFFLINE_HTML`, a small self-contained bilingual (DE/EN)
  branded page embedded directly in the SW script, for the rare case where even the shell isn't
  cached yet either. A non-navigation sub-resource request just fails outright on the same
  rejection — a fallback page only makes sense for something the user is actually looking at.

  `OFFLINE_HTML` is bilingual DE/EN together rather than picking one language, since the Service
  Worker has no access to the page's own localStorage-stored language preference.

**SW registration** happens whenever `navigator.onLine || !navigator.serviceWorker.controller` —
i.e. skip only when offline AND an existing SW is already controlling the page (nothing to gain,
and registering a same-origin script URL while offline can trigger a failed install attempt).
Gating on "no controller" rather than a blanket online-only check matters because iOS can evict an
installed PWA's SW registration entirely after a full force-quit; if the very next relaunch happens
to be offline, this still gives the app a chance to re-register and recover instead of being stuck
uncontrolled until connectivity returns. That offline recovery only works if the browser's HTTP
cache still holds `sw.js` — the SW's own fetch handler never serves its own script.

**Update flow**: `init()` calls `checkForUpdates()` unconditionally on every online app open — no
manual button, no confirmation banner. It fetches the live `index.html` with a cache-busting query
string (`?_check=${Date.now()}`) **and** `{ cache: 'no-store' }` — both are required: `no-store`
only bypasses the browser's HTTP cache, while the query string is what makes the request miss the
SW's own `caches.match()` lookup so it actually reaches the network instead of comparing the
running version against itself. Checks `res.ok` before parsing (a transient HTTP error must not be
treated as "no update"), regex-extracts the response's embedded `APP_VERSION`, and only proceeds if
it is *newer* than the running version (`compareVersions()`, numeric semver — a stale CDN edge
serving an older copy must not downgrade the app) — then writes the already-fetched response directly into every
existing Cache Storage entry across every shell URL variant (`location.href`, `swScope`,
`swScope + 'index.html'`) and reloads immediately. It also refetches `manifest.json` and
`handball_icon.png` (best-effort) and writes them into the cache in the same pass — the SW serves
those cache-first and would otherwise only refresh them when `sw.js` itself changes, so a changed
icon/manifest reaches installed copies with a normal version bump. Any network/offline failure is swallowed
silently — the app keeps running the current cached version and retries on the next online open.
Bump `APP_VERSION` (semver `MAJOR.MINOR.PATCH`) on every deploy you want this to detect.

`init()` also calls `navigator.storage.persist()` (feature-detected, result ignored) as a
best-effort mitigation against the SW-eviction behavior above — Safari's support for this is
inconsistent and it does not reliably prevent eviction, but it's harmless to request regardless.

**Wake Lock**: `navigator.wakeLock` keeps the screen on during a match. On iOS this requires
**18.4+** ([webkit.org/b/254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — the API didn't
work in Home Screen Web Apps at all before that). Even on 18.4+, WebKit requires **transient user
activation** (a direct tap) to grant `navigator.wakeLock.request()` — a `visibilitychange` handler
or `setInterval` callback does not count and can silently fail with `NotAllowedError` (swallowed by
`catch {}`). The retry strategy is layered, cheapest/least-reliable first: `visibilitychange`
(likely rejected per the activation requirement, harmless to try anyway), a 20s `setInterval`
safety net (same caveat), and a `touchstart` listener that reacquires whenever `!wl` — the one most
likely to succeed, since this app has near-constant real taps during a match and a genuine tap does
carry transient activation. This is always on, unconditionally, with no settings toggle — don't
add one. `requestWakeLock()` guards against re-entry (`wakeLockRequesting`) since all three
triggers can fire while an earlier `request()` is still pending — without the guard, two concurrent
in-flight requests can each resolve to a distinct lock sentinel, and whichever assigns `wl` last
orphans the other's `release` listener. Don't add a muted-video/canvas/audio keep-awake fallback —
tried before, confirmed on-device not to prevent the OS auto-lock.

## Design tokens

**Spacing/radius**: `--radius-sm/md/lg` (12/16/22px) and `--space-1..6` (4/8/12/16/24/32px) are CSS
custom properties on `:root`. New `border-radius`/`gap`/`padding`/`margin` values should reuse one
of these rather than introducing another one-off px value; a few values that don't cleanly fit the
scale (e.g. 14px/18px/20px, mostly button padding tuned against a `min-height`) are deliberately
left as literals rather than forced onto the scale.

**Font size**: `--font-md` (14px) is the one harmonized size for general UI text — buttons,
settings rows, history text, modal titles/labels, badges, etc. Deliberately **not** applied to: the
score (`.team-score`, `.history-score` — kept large by design), the match clock
(`.clock-start`/`.clock-stop`/`.clock-display`/`.clock-half` — intentionally larger than body text),
the player-number keypad (`.keypad-btn`/`#player-number-display` — large for fast entry), icon-
glyph-only buttons sized against a fixed square/circle (`.minus-btn`, `.del-btn`, `.hz-badge`), and
text `<input>`s (`.name-input`/`.number-input` and history-edit-row variants) — inputs must stay at
**16px or larger**, or focusing them triggers iOS Safari's automatic zoom-in. If a new UI text
element is added, default to `var(--font-md)` unless it clearly belongs to one of these exempted
families.

**Color**: `--bg`/`--card`/`--btn` form a 3-step light ramp (dark theme: darkest → lightest) used
for background/card/pressable-surface elevation; `--border`/`--btn-border` are low-opacity overlays
rather than solid colors so they read correctly against either `--bg` or `--card`. `--accent`
(blue, primary actions), `--success` (green — running-clock color, finish-and-save confirmation
flash), and `--danger` (red — destructive actions, finish-of-time clock color) are semantic tokens
shared by both themes. These are deliberately **separate** from `PRESETS`/`ALL_COLORS` (the
user-facing team-color palette) and from `state.a.color`/`state.b.color`'s hardcoded defaults —
don't wire those to the semantic tokens, since a user's chosen team color and the app's own UI
chrome color are unrelated concepts that happen to sometimes share a hue. Two call sites
intentionally use a literal green instead of `var(--success)`: the player-number keypad's ✓ button
(`#2e7d32`) and the save-flash's dark background (`#123821`) — `--success` (`#22c55e`) is tuned to
read well as text/an indicator color, and white text directly on top of it fails contrast; keep
these two as literals rather than "simplifying" to `var(--success)`.

`state.cardAccentEnabled` (Settings → Darstellung/Appearance, default on) gates the radial-gradient
team-color accent that `render()` applies to `card-a`/`card-b`'s `background` — when off it falls
back to plain `var(--card)`. `.team-score.pulse` (`scorePulse` keyframe) is toggled in `render()`
based on `lastRenderedScore[identity]` — each **identity's own** last-rendered score, tracked
separately from the physical slot, since `swapTeams()` makes the same slot show a different
identity's score without any goal happening. `lastRenderedScore` is reset to `{a:null, b:null}` in
`resetGame()`/`saveGame()` so the score dropping back to 0 isn't itself treated as a "changed" score
and pulsed. One-shot animation classes (`pulse` on `disp-a`/`disp-b`, `ended` on `clock-display`)
are removed on `animationend`/`animationcancel` — a class left in place restarts its animation
whenever the element becomes visible again (every return to the Game tab, since `view-game`
toggles `display:none`).

The `<meta name="theme-color">` is updated in `applyTheme()` to match `--bg` (`#0b0c0f` dark /
`#f4f5f9` light); `manifest.json`'s `theme_color`/`background_color` use the dark value.
`applyTheme()` likewise sets `apple-mobile-web-app-status-bar-style` to `black` (dark) /
`default` (light) — iOS may only read it at launch, so it can lag a theme switch until the next
app start.

`:focus-visible` styling is one global rule (`button, input, [tabindex]`) — don't add
element-specific `:focus-visible` rules.

## Touch/mobile behavior

**Safe areas**: `body` padding is `max(env(safe-area-inset-*), <token>)` on all four sides — the
inset where there is one (notch, home indicator, landscape notch on the left/right), the normal
spacing token otherwise. Plain `env(x, fallback)` isn't enough: its fallback only applies when
`env()` is unsupported, not when the inset is 0.

**Touch-only target**: this app is used one-handed on a phone touchscreen during a live match —
optimize for tap targets, haptic feedback (`navigator.vibrate`), and portrait/landscape layout, not
keyboard or mouse interaction.

**Pinch-zoom prevention**: blocked via `gesturestart`/`gesturechange` `preventDefault()` (Safari-
specific events) plus a `document`-level `touchmove` listener that calls `preventDefault()` when
`e.touches.length > 1` (cross-browser fallback for platforms without gesture events, e.g. Android
Chrome). `document.body` has its own `touchmove` listener that calls `stopPropagation()` on
single-touch moves, to keep them from bubbling up and triggering iOS's rubber-band overscroll on
the outer `fixed`-positioned `html`/`body` — it handles the multi-touch case directly first
(`preventDefault()` + `return` before reaching `stopPropagation()`), since `body`'s listener fires
before `document`'s in the bubble phase and would otherwise swallow the multi-touch check on any
platform without gesture-event support. If touching either listener again, verify pinch-zoom is
still blocked on a platform without `gesturestart` support, not just on Safari.

**Double-tap zoom**: `* { touch-action: manipulation; }` disables double-tap-to-zoom (iOS ignores
`user-scalable=no`), so two quick taps on a team card register as two goals. It still permits
pinch, which the listeners above block.
