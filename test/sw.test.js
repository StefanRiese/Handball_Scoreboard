// Runs sw.js in a vm sandbox with an in-memory Cache Storage and a scriptable fetch().
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./helpers');

const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const BASE = 'https://example.test/app/';

// network: url → Response | 'fail' (rejects, as when offline). Unknown URLs fail too.
function loadSw(network = {}) {
  const stores = new Map();
  const key = r => (typeof r === 'string' ? new URL(r, BASE).href : r.url);
  const openStore = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (r, res) => { m.set(key(r), res); },
      match: async r => { const res = m.get(key(r)); return res && res.clone(); },
    };
  };
  const caches = {
    open: async name => openStore(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async r => {
      for (const name of stores.keys()) { const res = await openStore(name).match(r); if (res) return res; }
    },
  };
  const listeners = {};
  const fetchLog = [];
  const self = {
    location: new URL('sw.js', BASE),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  const fetch = async (req, init) => {
    const url = key(req);
    fetchLog.push({ url, init });
    const res = network[url];
    if (!res || res === 'fail') throw new TypeError('Failed to fetch');
    return res.clone();
  };
  vm.runInNewContext(SW, { self, caches, fetch, Response, Headers, URL, Promise, Error });

  const dispatch = (type, extra = {}) => {
    let p, responded;
    listeners[type]({ ...extra, waitUntil: x => { p = x; }, respondWith: x => { responded = x; } });
    return responded || p;
  };
  return {
    stores, fetchLog,
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    fetch: (url, mode = 'no-cors') => dispatch('fetch', { request: { url: new URL(url, BASE).href, mode } }),
  };
}

const ok = body => new Response(body, { status: 200 });
const shellNetwork = () => ({
  [BASE]: ok('root'), [BASE + 'index.html']: ok('index'),
  [BASE + 'manifest.json']: ok('{}'), [BASE + 'handball_icon.png']: ok('png'),
});

test('install precaches the whole shell, bypassing the HTTP cache', async () => {
  const sw = loadSw(shellNetwork());
  await sw.install();
  const [name] = sw.stores.keys();
  assert.equal(sw.stores.get(name).size, 4);
  assert.ok(sw.fetchLog.every(f => f.init.cache === 'reload'));
});

test('install tolerates a missing icon but fails if both page URLs fail', async () => {
  const partial = shellNetwork();
  partial[BASE + 'handball_icon.png'] = new Response('', { status: 404 });
  await loadSw(partial).install();

  const broken = shellNetwork();
  broken[BASE] = 'fail';
  broken[BASE + 'index.html'] = new Response('', { status: 500 });
  await assert.rejects(loadSw(broken).install(), /shell cache install failed/);
});

test('activate deletes caches other than the current one', async () => {
  const sw = loadSw(shellNetwork());
  await sw.install();
  sw.stores.set('old-cache', new Map());
  await sw.activate();
  assert.equal(sw.stores.size, 1);
  assert.ok(!sw.stores.has('old-cache'));
});

test('fetch is cache-first and stamps navigations with no-store', async () => {
  const net = shellNetwork();
  const sw = loadSw(net);
  await sw.install();
  net[BASE + 'index.html'] = ok('newer');
  const res = await sw.fetch('index.html', 'navigate');
  assert.equal(await res.text(), 'index');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const icon = await sw.fetch('handball_icon.png');
  assert.equal(icon.headers.get('Cache-Control'), null, 'sub-resources are not stamped');
});

test('cache miss goes to the network with no-store', async () => {
  const sw = loadSw({ [BASE + 'other.js']: ok('js') });
  const res = await sw.fetch('other.js');
  assert.equal(await res.text(), 'js');
  assert.equal(sw.fetchLog.at(-1).init.cache, 'no-store');
});

test('offline navigation falls back to the cached shell, then to the offline page', async () => {
  const sw = loadSw(shellNetwork());
  await sw.install();
  const res = await sw.fetch('index.html?_check=1', 'navigate');
  assert.equal(await res.text(), 'index');

  const empty = loadSw();
  const offline = await empty.fetch('index.html', 'navigate');
  assert.match(await offline.text(), /No internet connection/);
  assert.equal(offline.headers.get('Cache-Control'), 'no-store');

  await assert.rejects(empty.fetch('other.js'), /Failed to fetch/);
});
