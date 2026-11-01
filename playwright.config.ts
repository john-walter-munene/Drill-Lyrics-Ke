import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a **running stack**, not a dev server this file
 * boots: the flows under test (accounts, review queue, publishing) need Postgres
 * and the API, which only exist in the Docker stack. `docs/context.md` names
 * Playwright as the e2e tool and `docs/runbook.md` is how the stack comes up.
 *
 *   npm run dev:stack        # or: npm run stack:up
 *   npm run test:e2e
 *
 * The suite skips itself with a clear message when the stack is not reachable,
 * so a machine without Docker still gets a green `npm run test` and a runnable
 * `npm run test:e2e` that says why it did nothing.
 */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // The review flow mutates shared state (one published version per song), so
  // tests run in order rather than in parallel workers.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
