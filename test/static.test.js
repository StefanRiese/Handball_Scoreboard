// Repo-level invariants that don't need a running app: syntax, manifest/icon, version format.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, HTML } = require('./helpers');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('index.html has exactly one inline <script> and it parses', () => {
  const scripts = HTML.match(/<script>([\s\S]*?)<\/script>/g);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(HTML.match(/<script>([\s\S]*)<\/script>/)[1]));
});

test('sw.js parses', () => {
  assert.doesNotThrow(() => new Function(read('sw.js')));
});

test('APP_VERSION is MAJOR.MINOR.PATCH', () => {
  const m = HTML.match(/const APP_VERSION = '([^']+)'/);
  assert.ok(m, 'APP_VERSION declaration not found');
  assert.match(m[1], /^\d+\.\d+\.\d+$/);
  // checkForUpdates() finds the deployed version with this exact regex.
  assert.equal(HTML.match(/APP_VERSION\s*=\s*'([^']+)'/)[1], m[1]);
});

test('sw.js CACHE is a static string, not derived from APP_VERSION', () => {
  const sw = read('sw.js');
  assert.match(sw, /const CACHE = '[^']+';/);
  assert.doesNotMatch(sw, /APP_VERSION/);
});

test('manifest.json is valid and its icons exist with the declared size', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.name && manifest.start_url && manifest.display);
  for (const icon of manifest.icons) {
    const buf = fs.readFileSync(path.join(ROOT, icon.src));
    assert.equal(buf.subarray(1, 4).toString(), 'PNG', `${icon.src} is not a PNG`);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} size`);
  }
});

test('every file sw.js precaches exists in the repo', () => {
  for (const f of ['index.html', 'manifest.json', 'handball_icon.png']) {
    assert.ok(read('sw.js').includes(`SCOPE + '${f}'`), `${f} missing from SHELL`);
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing from repo`);
  }
});
