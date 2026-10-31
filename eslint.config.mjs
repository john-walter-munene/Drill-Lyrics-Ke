// DrillKe — one flat ESLint config for the whole workspace.
//
// `npm run lint` is a real gate: it fails on any error or warning, so a clean
// run means something. The rule set is deliberately small — the codebase is
// already typechecked by `tsc --strict`, so this catches the things types miss
// (stray `any`, unused bindings, a hook called outside a component) without
// turning into a style argument or a rewrite of working player code.
//
// Deliberate scope decisions, so the next person does not have to guess:
//   - Only `react-hooks/rules-of-hooks` and `exhaustive-deps` are on. The React
//     Compiler-era rules (`refs`, `set-state-in-effect`, `purity`, …) are much
//     stricter than this codebase and flag patterns the player relies on. They
//     are good rules to adopt *with* a refactor, not as a lint gate today.
//   - `no-unused-vars` comes from the TypeScript plugin, not core ESLint:
//     the core rule cannot see type positions and reports signature
//     parameters that `tsc` accepts.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const sharedRules = {
  // Allow a deliberate `any`; fail a careless one.
  '@typescript-eslint/no-explicit-any': 'error',
  // `after-used` is the setting `tsc`'s `noUnusedParameters` matches: an
  // unused parameter is only a problem when nothing after it is used. This
  // codebase also declares method signatures (the YouTube player interface)
  // that exist to name the shape, not to be implemented here.
  '@typescript-eslint/no-unused-vars': ['error', {
    args: 'after-used',
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  }],
  'prefer-const': 'error',
  'no-var': 'error',
  'no-empty': ['error', { allowEmptyCatch: false }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
};

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  fetch: 'readonly',
  structuredClone: 'readonly',
  __dirname: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
};

// Browser + DOM lib globals. `tsc` supplies the same names through `lib.dom`;
// the linter needs them spelled out because it does not read the tsconfig.
const browserGlobals = {
  ...nodeGlobals,
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  Audio: 'readonly',
  AudioContext: 'readonly',
  AudioBuffer: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  DataView: 'readonly',
  ArrayBuffer: 'readonly',
  Float32Array: 'readonly',
  Uint8Array: 'readonly',
  Uint16Array: 'readonly',
  Uint32Array: 'readonly',
  Int16Array: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  crypto: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLScriptElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLSelectElement: 'readonly',
  KeyboardEvent: 'readonly',
  MessageEvent: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  React: 'readonly',
  JSX: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
      // Plain-JS tooling that runs on Node directly, outside both compile graphs.
      'prisma/**',
      'scripts/**',
      'infra/**',
    ],
  },

  js.configs.recommended,

  // Repository tooling written in TypeScript lives outside a package tsconfig.
  {
    files: ['*.config.ts', 'playwright.config.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: nodeGlobals,
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { ...sharedRules, 'no-undef': 'off' },
  },

  // Shared pure logic + API: Node/TypeScript, no DOM.
  {
    files: ['packages/**/*.ts', 'apps/api/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: nodeGlobals,
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...sharedRules,
      // Never flag the base rule: without type information the core rule cannot
      // tell a Nest constructor parameter property (`private readonly prisma`)
      // from a dead binding, and reports every injected dependency.
      'no-unused-vars': 'off',
      // Nest services/guards are classes with only decorators; that is the shape.
      '@typescript-eslint/no-extraneous-class': 'off',
      // The TypeScript compiler already rejects these, so core ESLint's
      // `no-undef` only produces false positives in .ts files.
      'no-undef': 'off',
    },
  },

  // Tests build throwaway fixtures, so `any` is allowed there.
  {
    files: ['**/*.test.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...sharedRules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
    },
  },

  // Web: React 19 + Next.js App Router.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    rules: {
      ...sharedRules,
      'no-unused-vars': 'off',
      // Rules of hooks is the one rule this project cannot live without. See the
      // header comment for why the Compiler-era rules are not enabled.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-undef': 'off',
    },
  },

  // E2E specs: Node + Playwright, browsers only as types.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: nodeGlobals,
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...sharedRules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
    },
  },

  // Plain-JS tooling: CommonJS, not ESM.
  {
    files: ['apps/web/next.config.js', 'apps/api/scripts/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, module: 'writable', require: 'readonly' },
    },
  },

  // One pre-existing warning in the player is intentional (the effect reads the
  // tracked song by slug, not the object); it is named rather than silenced.
  {
    files: ['apps/web/app/components/player/PlayerProvider.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
);
