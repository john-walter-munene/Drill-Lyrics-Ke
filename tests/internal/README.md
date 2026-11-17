# Internal unit tests

Tests for the pure logic that lives in `packages/shared` and inside the API and
web apps. They are kept **out of the packages** on purpose: a package's `src`
should read as the thing it ships, not as the thing it ships interleaved with
the tests that prove it.

```text
tests/internal/
  shared/     packages/shared/src  — parsers, contracts, shared rules
  api/        apps/api/src         — server-side logic with no database
  web/        apps/web/app         — client-side logic with no browser
```

Each folder mirrors the module it targets, so `tests/internal/api/songs/`
is the test home for `apps/api/src/modules/songs/`. A new test goes beside the
**feature**, not beside the file.

## What belongs here

Pure functions and rules: parsers, validators, scoring, state predicates and
contracts. No database, no network, no browser — these run under
`node --test` with type stripping and must stay fast enough to run on every
save.

**Not here:** anything that needs Postgres, the API process or a rendered page.

| Suite | Location | Runs on |
|---|---|---|
| These unit tests | `tests/internal/**/*.test.ts` | `npm test` — no Docker |
| End-to-end flows | `e2e/` | `npm run test:e2e` — needs the stack |
| Live-stack checks | `scripts/smoke-*.mjs` | `npm run smoke:*` — needs the stack |

## Importing what you test

Tests import **source** (`../../../../packages/shared/src/lyrics.ts`,
`../../../apps/api/src/modules/search/relevance.ts`), never `dist/` and never
the built package entry point. A test that imports the build can pass against
a stale `dist` while the source is broken.

Shared tests import within the package relatively (`../../types.ts`), so the
package keeps a single module identity and no test needs a build first.

## Adding a suite

1. Pick the feature folder — e.g. `tests/internal/api/competitions/`.
2. Name the file after the unit, not the user story: `tie-break.test.ts`.
3. Import from source with a relative path.
4. `npm test` picks it up automatically; there is no list to update.
