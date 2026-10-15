// Behavioral tests against the real index.html, booted in jsdom.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers');

let ctx;
const boot = async opts => (ctx = await bootApp(opts));
afterEach(() => {
  if (!ctx) return;
  // No uncaught page errors in any test.
  assert.deepEqual(ctx.errors.map(e => e.message), []);
  ctx.close();
  ctx = null;
});
const $ = id => ctx.document.getElementById(id);
const plain = v => JSON.parse(JSON.stringify(v)); // cross-realm objects → comparable with deepEqual

test('boots cleanly and persists defaults on first open', async () => {
  const { app, stored } = await boot();
  assert.equal($('version-value').textContent, app.APP_VERSION);
  assert.equal(stored().half, 0);
  assert.equal($('disp-a').textContent, '0');
});

test('i18n: de and en define the same keys', async () => {
  const { app } = await boot();
  assert.deepEqual(Object.keys(app.I18N.en).sort(), Object.keys(app.I18N.de).sort());
});

test('DEFAULT_SETTINGS matches the initial state and every setting is persisted', async () => {
  const { app, state, stored } = await boot();
  const saved = stored();
  for (const [k, v] of Object.entries(app.DEFAULT_SETTINGS)) {
    assert.deepEqual(plain(state[k]), plain(v), `state.${k} differs from DEFAULT_SETTINGS`);
    assert.ok(k in saved, `save() does not persist ${k}`);
  }
});

test('confirmResetSettings() restores DEFAULT_SETTINGS but keeps live match state', async () => {
  const { app, state } = await boot();
  state.trackPlayerNumbers = false;
  app.addGoal('a');
  Object.assign(state, { darkMode: false, lang: 'en', halfLength: 20, singleRevertMode: true, team1OnLeft: false });
  state.a.name = 'X';
  app.confirmResetSettings();
  for (const [k, v] of Object.entries(app.DEFAULT_SETTINGS)) assert.deepEqual(plain(state[k]), plain(v), k);
  assert.equal(app.total('a'), 1);
});

test('compareVersions() is numeric, not lexicographic', async () => {
  const { app } = await boot();
  assert.ok(app.compareVersions('1.10.0', '1.9.0') > 0);
  assert.ok(app.compareVersions('1.9.9', '1.10.0') < 0);
  assert.equal(app.compareVersions('1.2', '1.2.0'), 0);
  assert.ok(app.compareVersions('2.0.0', '1.99.99') > 0);
});

test('escapeHtml() escapes all five HTML-special characters', async () => {
  const { app } = await boot();
  assert.equal(app.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('scorerTally() merges leading-zero numbers and counts unknown scorers', async () => {
  const { app } = await boot();
  const tally = plain(app.scorerTally({ scorers: [{ number: '03' }, { number: '3' }, { number: '00' }, { number: '12' }, { number: null }] }));
  assert.deepEqual(tally, { numbers: ['0', '3', '12'], counts: { 0: 1, 3: 2, 12: 1 }, unknown: 1 });
  assert.equal(app.scorerTally({ scorers: [] }), null);
  assert.deepEqual(plain(app.scoreFactor({ score: 5, scorers: [{ number: '7' }, { number: '9' }, { number: null }] })), { distinct: 2, factor: 10 });
});

test('readableColor() lightens dark colors in dark mode and darkens light colors in light mode', async () => {
  const { app, state } = await boot();
  const lightness = hex => app.hexToHsl(hex)[2];
  state.darkMode = true;
  assert.ok(lightness(app.readableColor('#111111')) >= 34.5);
  assert.equal(app.readableColor('#e24b4a'), '#e24b4a');
  state.darkMode = false;
  assert.ok(lightness(app.readableColor('#f0f0f0')) <= 65.5);
});

test('addGoal() scores immediately and opens the player-number keypad', async () => {
  const { app, state, stored } = await boot();
  app.addGoal('a');
  assert.equal($('disp-a').textContent, '1');
  assert.equal(stored().halves.a[0], 1);
  assert.equal($('player-modal').style.display, 'flex');
  app.pressDigit(0); app.pressDigit(7); app.pressDigit(9); // max two digits
  assert.equal($('player-number-display').textContent, '07');
  app.confirmPlayerNumber();
  assert.equal($('player-modal').style.display, 'none');
  assert.deepEqual(plain(state.scorers.a), [{ half: 0, number: '07', pos: 1, globalPos: 1 }]);
});

test('a goal scored while the keypad is open is queued behind it', async () => {
  const { app, state } = await boot();
  app.addGoal('a');
  app.addGoal('b');
  assert.equal(app.total('b'), 1);
  app.pressDigit(5); app.confirmPlayerNumber();
  assert.equal($('player-modal').style.display, 'flex', 'queued entry reopens the keypad');
  assert.equal(app.playerModalIdentity, 'b');
  app.skipPlayerNumber();
  assert.deepEqual(plain(state.scorers), {
    a: [{ half: 0, number: '5', pos: 1, globalPos: 1 }],
    b: [{ half: 0, number: null, pos: 1, globalPos: 1 }],
  });
});

test('correct() removes the matching scorer entry and never goes below zero', async () => {
  const { app, state } = await boot();
  app.addGoal('a'); app.pressDigit(4); app.confirmPlayerNumber();
  app.addGoal('a'); app.pressDigit(8); app.confirmPlayerNumber();
  app.correct('a', -1);
  assert.equal(app.total('a'), 1);
  assert.deepEqual(plain(state.scorers.a.map(s => s.number)), ['4']);
  app.correct('a', -1); app.correct('a', -1);
  assert.equal(app.total('a'), 0);
  assert.deepEqual(plain(state.scorers.a), []);
});

test('goals land on the identity shown in the tapped slot after a side swap', async () => {
  const { app, state } = await boot();
  state.trackPlayerNumbers = false;
  app.swapTeams();
  assert.equal(state.team1OnLeft, false);
  app.addGoal('a'); // left card now shows Team 2
  assert.deepEqual(plain(state.halves), { a: [0, 0], b: [1, 0] });
  assert.equal($('disp-a').textContent, '1');
  assert.equal($('name-a').textContent, state.b.name);
});

test('halftime auto-swap is undone on return to half 0, reset and finish', async () => {
  const { app, state } = await boot();
  app.setHalf(1);
  assert.equal(state.team1OnLeft, false);
  assert.equal(state.halftimeSwapped, true);
  app.setHalf(0);
  assert.equal(state.team1OnLeft, true);

  app.setHalf(1);
  state.autoSwapAtHalftime = false; // toggled mid-match must not change the undo
  app.resetGame();
  assert.equal(state.half, 0);
  assert.equal(state.team1OnLeft, true);

  state.autoSwapAtHalftime = true;
  app.setHalf(1);
  app.saveGame();
  assert.equal(state.team1OnLeft, true);
});

test('saveGame() records Team 1 first with halftime score and scorers, then resets the match', async () => {
  const { app, state } = await boot();
  app.addGoal('a'); app.pressDigit(9); app.confirmPlayerNumber();
  app.addGoal('b'); app.skipPlayerNumber();
  app.setHalf(1); // sides swap: slot 'a' is now Team 2
  app.addGoal('a'); app.skipPlayerNumber();
  state.a.name = '';
  app.saveGame();
  const [g] = plain(state.history);
  assert.equal(g.teams[0].name, app.t('team1'), 'blank name falls back to the placeholder');
  assert.deepEqual(g.teams.map(t => [t.score, t.halftimeScore]), [[1, 1], [2, 1]]);
  assert.deepEqual(g.teams[0].scorers.map(s => s.number), ['9']);
  assert.deepEqual(plain(state.halves), { a: [0, 0], b: [0, 0] });
  assert.deepEqual(plain(state.scorers), { a: [], b: [] });
  assert.equal(state.clockRemaining, state.halfLength * 60);
});

test('saveGame() and resetGame() discard a still-open keypad and its queue', async () => {
  const { app, state } = await boot();
  app.addGoal('a'); app.addGoal('b');
  app.saveGame();
  assert.equal($('player-modal').style.display, 'none');
  assert.equal(app.playerNumberQueue.length, 0);
  app.addGoal('a'); app.addGoal('a');
  app.resetGame();
  assert.equal(app.playerNumberQueue.length, 0);
  assert.equal(app.playerModalIdentity, null);
  assert.deepEqual(plain(state.scorers), { a: [], b: [] });
});

test('two saves in the same millisecond get distinct ids', async () => {
  const { app, state, window } = await boot();
  window.Date.now = () => 1_700_000_000_000;
  app.saveGame(); app.saveGame();
  assert.notEqual(state.history[0].id, state.history[1].id);
});

test('single-revert mode: one revert per goal, aimed at the half the goal was scored in', async () => {
  const { app, state } = await boot();
  Object.assign(state, { trackPlayerNumbers: false, singleRevertMode: true, autoSwapAtHalftime: false });
  app.addGoal('a');
  assert.notEqual($('corr-minus-a').style.display, 'none');
  assert.equal($('corr-minus-b').style.display, 'none');
  app.setHalf(1);
  app.correct('a', -1);
  assert.deepEqual(plain(state.halves.a), [0, 0]);
  assert.equal(app.revertWindow.a, null);
  assert.equal($('corr-minus-a').style.display, 'none');
});

test('saveEditGame() trims scorers by globalPos and keeps history newest-first', async () => {
  const { app, state } = await boot();
  state.history = [
    { id: 2000, date: '', time: '', teams: [
      { name: 'A', score: 5, color: '#e24b4a', halftimeScore: 3, scorers: [{ half: 0, number: '1', pos: 2, globalPos: 2 }, { half: 1, number: '2', pos: 1, globalPos: 4 }] },
      { name: 'B', score: 1, color: '#378add', halftimeScore: 1, scorers: [] },
    ] },
    { id: 1000, date: '', time: '', teams: [{ name: 'C', score: 0, color: '#e24b4a', halftimeScore: 0, scorers: [] }, { name: 'D', score: 0, color: '#378add', halftimeScore: 0, scorers: [] }] },
  ];
  app.askEditGame(2000);
  $('edit-score0-2000').value = '2';
  app.saveEditGame(2000);
  let g = state.history.find(g => g.id === 2000);
  assert.equal(g.teams[0].halftimeScore, 2);
  assert.deepEqual(g.teams[0].scorers.map(s => s.number), ['1']);

  // Moving the game before the other one re-sorts the list.
  app.askEditGame(2000);
  $('edit-date-2000').value = '1969-12-31';
  $('edit-time-2000').value = '00:00';
  app.saveEditGame(2000);
  assert.deepEqual(state.history.map(g => g.teams[0].name), ['C', 'A']);
});

test('load() restores saved state, keeps an intentionally empty name and sanitizes bad scores', async () => {
  const { state } = await boot({ stored: { a: { name: '', color: '#4caf50' }, halves: { a: ['3', 'x'], b: [1, 2] }, half: 1, lang: 'en', halfLength: 500 } });
  assert.equal(state.a.name, '');
  assert.equal(state.a.color, '#4caf50');
  assert.deepEqual(plain(state.halves), { a: [3, 0], b: [1, 2] });
  assert.equal(state.lang, 'en');
  assert.equal(state.halfLength, 30, 'out-of-range half length is ignored');
  assert.equal($('name-a').textContent, 'Team 1');
});

test('load() survives corrupt localStorage', async () => {
  const { state } = await boot({ stored: '{not json' });
  assert.equal(state.clockRunning, false);
  assert.equal(state.clockRemaining, state.halfLength * 60);
  assert.equal($('disp-a').textContent, '0');
});

test('a running clock resumes from its absolute end time on reopen', async () => {
  const { state } = await boot({ stored: { clockRunning: true, clockEndsAt: Date.now() + 90_500, halfLength: 30 } });
  assert.equal(state.clockRunning, true);
  assert.ok([90, 91].includes(state.clockRemaining));
});

test('a first half that ended while closed is replayed: half 1, sides swapped, saved', async () => {
  const { state, stored } = await boot({ stored: { half: 0, clockRunning: true, clockEndsAt: Date.now() - 5000, halfLength: 20, autoSwapAtHalftime: true } });
  assert.equal(state.half, 1);
  assert.equal(state.team1OnLeft, false);
  assert.equal(state.clockRunning, false);
  assert.equal(state.clockRemaining, 20 * 60);
  assert.equal(stored().half, 1, 'replay is persisted so a second reopen does not flip sides back');
});

test('stop/start does not drift: pausing keeps the sub-second remainder', async () => {
  const { app, state, window } = await boot();
  let now = 1_000_000;
  window.Date.now = () => now;
  app.startClock();
  now += 10_400;
  app.stopClock();
  assert.equal(state.clockRemaining, 30 * 60 - 10);
  app.startClock();
  assert.equal(state.clockEndsAt - now, 30 * 60 * 1000 - 10_400);
  app.stopClock();
});

test('clock end of the first half advances to half 2', async () => {
  const { app, state, window } = await boot();
  let now = 1_000_000;
  window.Date.now = () => now;
  app.startClock();
  now += 30 * 60 * 1000 - 400;
  app.tickClock();
  assert.equal(state.clockRemaining, 1, 'remaining seconds are ceil\'d, so the half does not end early');
  assert.equal(state.half, 0);
  now += 400;
  app.tickClock();
  assert.equal(state.half, 1);
  assert.equal(state.clockRunning, false);
  assert.equal(state.clockRemaining, 30 * 60);
  assert.ok($('clock-display').classList.contains('ended'));
});

test('applyLang() switches visible text to English', async () => {
  const { app, state } = await boot();
  state.lang = 'en';
  app.applyLang();
  app.render();
  assert.equal($('save-btn').textContent, app.I18N.en.save);
});

test('history renders team names escaped', async () => {
  const { app, state } = await boot();
  state.a.name = '<img src=x onerror=alert(1)>';
  app.saveGame();
  app.renderHistory();
  assert.equal(ctx.document.querySelector('#view-history img'), null);
});
