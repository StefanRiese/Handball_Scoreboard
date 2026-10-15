import js from '@eslint/js';
import globals from 'globals';
import html from 'eslint-plugin-html';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    // `catch {}` is used on purpose for best-effort calls (wake lock, clipboard, update fetches).
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    // The app: the single inline <script> in index.html, a classic (non-module) browser script.
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { sourceType: 'script', globals: globals.browser },
    rules: {
      // Top-level functions are called from inline onclick="…" attributes ESLint can't see, so
      // only flag unused locals, not unused globals.
      'no-unused-vars': ['error', { vars: 'local', caughtErrors: 'none' }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
];
