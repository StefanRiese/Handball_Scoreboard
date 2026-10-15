// Boots the real index.html in jsdom so tests exercise the shipped code, not a copy of it.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STORAGE_KEY = 'handball_v3';

// stored: what a previous session left in localStorage — an object (JSON-encoded) or a raw string.
// Resolves once the page's DOMContentLoaded init() has run.
async function bootApp({ stored } = {}) {
  // Uncaught page errors are collected rather than just logged, so tests can assert none happened.
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(HTML, {
    virtualConsole,
    url: 'https://example.test/Handball_Scoreboard/index.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      if (stored) window.localStorage.setItem(STORAGE_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
      // Keep checkForUpdates() off the network; jsdom has no canvas, SW or clipboard either.
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.fetch = () => Promise.reject(new Error('no network in tests'));
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      // No-op 2D context for drawQrCode(): every method/property access is harmless.
      const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
      window.HTMLCanvasElement.prototype.getContext = () => ctx;
      window.document.elementsFromPoint = () => [];
    },
  });
  const { window } = dom;
  if (window.document.readyState === 'loading') {
    await new Promise(r => window.document.addEventListener('DOMContentLoaded', r));
  }
  // Top-level `let`/`const` bindings (state, revertWindow, …) aren't window properties, so read
  // them through the page's own global scope.
  const app = new Proxy({}, { get: (_, name) => window.eval(String(name)) });
  return {
    window,
    document: window.document,
    app,
    errors,
    get state() { return window.eval('state'); },
    stored: () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)),
    close: () => window.close(),
  };
}

module.exports = { bootApp, ROOT, HTML };
