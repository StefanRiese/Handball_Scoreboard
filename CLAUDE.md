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
- `handball_icon.png` — home-screen / manifest icon (512×512, matching `manifest.json`).
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

**Confirm-before-destructive-action pattern**: reset game, delete one history entry, clear all
history, and reset all settings to default (`confirmResetSettings()`, Settings → the merged
"Allgemein"/"General" section) each use the same link → Yes/No toggle pattern. Reset game and
reset settings use direct `style.display` toggles on sibling `<div>`s (no `pending*` variable);
delete/clear-all history use a `pending*` module-level variable instead since multiple history
entries share one confirm area and need to know *which* entry/whether "all". Follow whichever
sub-pattern fits (single fixed action → direct toggle; one-of-many entries → `pending*` id) rather
than `confirm()` dialogs or immediate deletion. The reset-game confirmation (`reset-confirm-area`)
and the finish-game confirmation (`finish-confirm-area`) live in the same game view and are
mutually exclusive — `askResetGame()`/`askFinish()` each close the other's confirmation first — and
`showView()` closes both when navigating away from the Game tab, the same way Settings/History
already clear their own pending confirmations on tab switch.

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
don't add back a migration in `load()` without checking whether that's still true. `exportHistory()`
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
`"00"`), not `parseInt`'d — a jersey number is an identifier, not an arithmetic value, and
`parseInt` would silently drop a leading zero the user deliberately entered; it's `null` when
skipped. `scorerTally()`'s `numbers` array (used by every scorer-display consumer) sorts these by
`Number(a) - Number(b)` without reformatting them, so display always matches what was typed.
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
into `state.scorers[identity]` and closes the modal — tapping outside the modal is wired to
`skipPlayerNumber()` for the same effect. Goals scored back-to-back (e.g. a quick double-tap)
before the first modal is confirmed/skipped are queued in `playerNumberQueue` (an array of
`{identity, half, pos, globalPos}`) rather than the second `addGoal()` overwriting the still-open
modal's state — `recordScorer()` drains the next queued entry after closing. `resetGame()` and
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

**Reset to default settings**: `DEFAULT_SETTINGS` (a standalone literal, not derived from the
mutable `state` object) mirrors the *initial* values of `state`'s Settings-tab fields — team
names/colors, `darkMode`, `lang`, `showClock`, `whatsappEnabled`, `team1OnLeft`,
`autoSwapAtHalftime`, `halfLength`, `trackPlayerNumbers`, `cardAccentEnabled` — and is what
`confirmResetSettings()` (Settings → "Allgemein"/"General", via `askResetSettings()`'s Yes/No
confirm) restores. Deliberately excludes `half`/`halves`/`history`/`clockRemaining`/
`clockRunning`/`clockEndsAt`/`scorers` — those are live match/history state, not settings, and
already have their own separate "Reset game"/"Clear history" actions; don't fold them into this
one. Keep `DEFAULT_SETTINGS` in sync by hand whenever `state`'s own initial literal changes — there
is no single source of truth between them since `state` mutates at runtime and can't be read back
from later. The General section also absorbed what used to be a separate "Information" section
(version, developer, QR code, share-app, add-to-home-screen) — don't re-split it without being
asked, that merge was intentional.

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

3. The install handler originally cached all four shell URLs via a single `cache.addAll(...)`
   call, which is all-or-nothing — if even one of the four fetches failed (a momentary network
   blip, a slow host, anything transient), the *entire* install failed and left nothing cached at
   all, not even the URLs that did succeed. Since install (via `register()`) retries on every
   online app open, this was intermittent rather than a hard failure — but it meant an offline
   open could hit zero cached shell despite install having "run" one or more times before. Fixed
   by caching each shell URL independently (`Promise.allSettled(SHELL.map(u =>
   fetch(u).then(r => c.put(u, r))))`) so one flaky request can't wipe out the others. Don't go
   back to `cache.addAll()` for this reason.

   `Promise.allSettled` alone introduced a new failure mode, though: it never rejects, so if
   *every* fetch failed (e.g. a completely dead connection right after the `navigator.onLine`
   check passed), the install would be reported to the browser as successful with an empty cache
   — and since nothing about the byte-identical SW script would ever differ on a later attempt,
   the browser would never retry install again, permanently leaving that install with zero offline
   coverage. Fixed by checking the settled results for `SHELL[0]`/`SHELL[1]` (the two page-shell
   URL variants) and throwing if fetching *both* failed, so the browser retries the whole install
   on the next online `register()` call; a manifest/icon-only failure is left non-fatal since the
   app still works offline without those two. Verified with a standalone simulation of the
   install logic (mocked `fetch`/cache) covering total failure, partial failure, and no failure —
   see git history around this note if that harness is needed again.

4. Each shell fetch's `.then(r=>c.put(u,r))` originally cached whatever `fetch()` resolved to
   without checking `r.ok` — `fetch()` only rejects on a network failure, not an HTTP error
   status, so a transient 404/500 for a shell URL (e.g. during a GitHub Pages deploy race) would
   resolve successfully and get cached as if it were the real file, with `Promise.allSettled`
   reporting it as fulfilled — bypassing the `SHELL[0]`/`SHELL[1]` rejection check above entirely
   and leaving the app permanently offline-serving a cached error page with no retry. Fixed by
   throwing inside that `.then()` when `!r.ok`, turning it into a proper rejection the existing
   check already handles.

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
reintroduce a `wakeLockEnabled`-style toggle for it without being asked. `requestWakeLock()` guards
against re-entry (`wakeLockRequesting`) since all three triggers can fire while an earlier
`navigator.wakeLock.request()` is still pending (`wl` stays `null` until it resolves) — without the
guard, two concurrent in-flight requests can each resolve to a distinct lock sentinel, and
whichever one assigns `wl` last orphans the other's own `release` listener, which can later null
`wl` even though the real lock is still held. A muted-video-loop
fallback was tried and removed (commit reverting "Add keep-awake video fallback") after on-device
testing showed it did not prevent the OS auto-lock; NoSleep.js's own source only uses that trick
for pre-Wake-Lock-API browsers and relies on native Wake Lock
alone wherever it's available, which is why it was abandoned here too — don't re-add a
video/canvas/audio keep-awake hack without new evidence it actually helps.

**Update flow — automatic, silent, on every online app open**: `init()` calls `checkForUpdates()`
whenever `navigator.onLine`, with no button and no confirmation banner — this is the *second*
design for this flow. The first design (manual-only, a "🔄 Check for updates" button in Settings)
was deliberately built after an even earlier automatic-check design was reverted at the user's
request; that manual design was itself later reverted back to automatic-on-open at the user's
explicit request (2026-08-14), after discovering that iOS evicts an installed PWA's Service Worker
registration when it's fully force-quit (a behavior also reported in
[GoogleChrome/workbox#1494](https://github.com/GoogleChrome/workbox/issues/1494)) — the next
relaunch's first navigation goes uncontrolled straight to the network and picks
up whatever's live on the host regardless of any in-app "check for updates" button, so the manual
gate was already being silently bypassed on iOS at exactly the moment (a fresh relaunch) it mattered
most. Given updates were arriving unrequested anyway on that platform, the manual button added
UI/i18n surface without actually preventing anything. **If asked to make this manual-only again,
that's a deliberate reversal of an explicit, dated decision — confirm with the user first**, the
same way the previous manual design asked to be confirmed before undoing.

`init()` also calls `navigator.storage.persist()` (feature-detected, result ignored either way) as
a mitigation attempt for the same SW-eviction root cause — requesting the origin be exempted from
storage eviction under pressure. This is **not a real fix**: Safari's support for the Storage API's
persistence request is inconsistent, and the actual eviction behavior found for standalone-PWA
Service Workers is a separate platform quirk this call doesn't address. It's harmless to request
regardless, which is the only reason it's there — don't remove it expecting it solved anything, and
don't expand it into a bigger "storage management" feature on the assumption it's load-bearing.

`checkForUpdates()` fetches the live file with a cache-busting query string
(`?_check=${Date.now()}`) AND `{cache: 'no-store'}`. Both are required, for two different layers:
`{cache: 'no-store'}` only bypasses the browser's own HTTP cache (needed since a `Cache-Control`
header from the host, e.g. GitHub Pages' `max-age=600`, would otherwise let the browser silently
reuse a stale response) — it does nothing about our Service Worker, whose fetch handler is
cache-first for every request regardless of the caller's `cache` option. Without the query-string
cache-bust, the SW would just re-serve whatever's already in Cache Storage (i.e. the
currently-running version) and the check would compare the running version against itself,
silently never detecting a real update. The query string exists purely to miss the SW's
`caches.match(e.request)` lookup so its own `r || fetch(e.request)` fallback actually reaches the
network — don't "simplify" this back to a plain `fetch(location.href, {cache:'no-store'})`, it
looks equivalent but reintroduces exactly this bug. Checks `res.ok` before parsing — `fetch()` only
rejects on a network failure, not on an HTTP error status, so without this check a transient
404/500 from the host would fall through with a non-matching body and `remoteVersion` would end up
`null`, silently doing nothing either way; the check just makes "nothing to do" explicit instead of
accidental. It regex-extracts the response's embedded `APP_VERSION`, and only proceeds if that
differs from the running version — then writes the already-fetched response directly into every
existing Cache Storage entry across every shell URL variant (`location.href`, `swScope`,
`swScope + 'index.html'`) and reloads immediately, with no user-facing confirmation step. Any
network/offline failure is swallowed silently (`catch` does nothing) — the app just keeps running
the current cached version and tries again on the next online open. Bump `APP_VERSION` (semver:
`MAJOR.MINOR.PATCH`) on every deploy you want this to detect — it's what the regex compares and
what changes the embedded SW script's bytes (so a subsequent normal page load still eventually
installs the new SW's `install`/`activate` lifecycle, e.g. to prune old-versioned caches).

Earlier iteration note: a simpler version of the manual button (before it was removed entirely)
just called `location.reload()` unconditionally on failure, which surfaced the browser's own "page
not available" error when offline (no cached fallback could satisfy the reload) — this design
avoids that by only ever reloading after a successful fetch+cache-write, and doing nothing at all
on failure.

**iOS home-screen quirk (historical, from the manual-button era)**: a standalone ("Add to Home
Screen") PWA on iOS did not reliably run the same update-check code on a cold app-switcher
relaunch as it did in a regular Safari tab. This is now moot for the update flow itself, since
`checkForUpdates()` runs unconditionally from `init()` on every open rather than from a button a
user could fail to reach — but the underlying platform behavior (a fresh standalone relaunch not
reliably running the same JS path as a backgrounded/foregrounded instance) may still be relevant
to other init-time logic on iOS.

**Design tokens**: corner radii and spacing are CSS custom properties on `:root` —
`--radius-sm/md/lg` (12/16/22px) and `--space-1..6` (4/8/12/16/24/32px — `--space-6` added
alongside a 2026-08 color/spacing pass that also folded several stray `10px`/`6px` literals into
the scale). New `border-radius`/`gap`/`padding`/`margin` values should reuse one of these rather
than introducing another one-off px value; a few values that don't cleanly fit the scale (e.g.
14px/18px/20px, mostly button padding tuned against a `min-height`) are still deliberately left as
literals rather than forced onto the scale and changing visual sizing.

**Color tokens**: `--bg`/`--card`/`--btn` form a 3-step light ramp (dark theme: darkest → lightest)
used for background/card/pressable-surface elevation; `--border`/`--btn-border` are low-opacity
overlays rather than solid colors so they read correctly against either `--bg` or `--card`.
`--accent` (blue, primary actions), `--success` (green, e.g. the running-clock color and the
finish-and-save confirmation flash), and `--danger` (red, destructive actions/buttons and the
finish-of-time clock color) are semantic tokens shared by both themes — introduced so `.btn-primary`/`.btn-danger`/`.clock-display.running`/`.clock-display.done` reference one place instead
of repeating hex literals. These are deliberately **separate** from `PRESETS`/`ALL_COLORS` (the
user-facing team-color palette) and from `state.a.color`/`state.b.color`'s hardcoded defaults —
don't wire those to the semantic tokens, since a user's chosen/default team color and the app's own
UI chrome color are unrelated concepts that happen to sometimes share a similar hue. Two
call sites intentionally use a literal green instead of `var(--success)`: the player-number
keypad's ✓ button (`#2e7d32`) and the save-flash's dark background (`#123821`) — `--success`
(`#22c55e`) is tuned to read well *as text/an indicator color*, and white text directly on top of
it fails contrast; those two sites need a darker green fill instead, so keep them as literals
rather than "simplifying" to `var(--success)`.
`state.cardAccentEnabled` (Settings → Darstellung/Appearance, default on) gates the radial-gradient
team-color accent that `render()` applies to `card-a`/`card-b`'s `background` — when off it falls
back to plain `var(--card)`. `.team-score.pulse` (a `scorePulse` keyframe) is toggled in `render()`
based on `lastRenderedScore[identity]` — each **identity's own** last-rendered score, tracked
separately from the physical slot — not on whether the slot's displayed text changed. That
distinction matters because `swapTeams()` makes the same slot show a different identity's score
without any goal happening; comparing the slot's own prior text would've pulsed on every swap.
`lastRenderedScore` is reset to `{a:null, b:null}` in `resetGame()`/`saveGame()` so the score
dropping back to 0 isn't itself treated as a "changed" score and pulsed.
`:focus-visible` styling is one global rule (`button, input, [tabindex]`) — don't add
element-specific `:focus-visible` rules again (there used to be a `.color-dot`-only one).

**Touch-only target**: this app is used one-handed on a phone touchscreen during a live match —
optimize for tap targets, haptic feedback (`navigator.vibrate`), and portrait/landscape layout,
not keyboard or mouse interaction.

**Pinch-zoom prevention**: blocked via `gesturestart`/`gesturechange` `preventDefault()` calls
(Safari-specific events) plus a `document`-level `touchmove` listener that calls `preventDefault()`
when `e.touches.length > 1` (the cross-browser fallback, since not every mobile browser fires the
gesture events). `document.body` also has its own `touchmove` listener that calls
`stopPropagation()` on single-touch moves, to keep them from bubbling up to `document`/`window`
and triggering iOS's rubber-band overscroll on the outer `fixed`-positioned `html`/`body` — but
since `body` sits between the touch target and `document` in the bubble phase, it fires *first*,
so unconditionally calling `stopPropagation()` there also silently swallowed the document-level
listener's multi-touch check on any platform without gesture-event support (e.g. Android Chrome),
leaving pinch-zoom unblocked. Fixed by handling the multi-touch case directly in `body`'s own
listener (`preventDefault()` and `return` before ever reaching `stopPropagation()`) rather than
relying on it bubbling to `document`. If touching either listener again, keep in mind they're not
independent — verify pinch-zoom is still blocked on a platform without `gesturestart` support, not
just on Safari.
