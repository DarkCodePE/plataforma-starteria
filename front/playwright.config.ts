/**
 * Playwright config for Starteria E2E tests.
 *
 * Assumes the docker compose stack is up (`docker compose up -d`) so frontend
 * is reachable at http://localhost. To run against a different base URL, set
 * the `E2E_BASE_URL` env var.
 *
 * Run: `npm run test:e2e` (single browser) or `npm run test:e2e:headed` to debug.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_PROD_BASE_URL || (process.env.E2E_BASE_URL || 'http://localhost');

export default defineConfig({
  testDir: './e2e',
  // Spec files live in e2e/, not the unit-test src/**.
  testMatch: /.*\.spec\.ts$/,
  // e2e/prod corre contra un entorno real con el tenant dedicado: sólo con `npm run test:e2e:prod`.
  testIgnore: process.env.E2E_PROD_BASE_URL ? undefined : ['**/prod/**'],

  // Each scenario goes through registration → login → upload → polling;
  // give each test up to 3 min so the live LLM call can complete when configured.
  timeout: 180_000,
  expect: { timeout: 15_000 },

  // Tests are independent — run them sequentially to avoid stomping on the
  // shared dev DB. Bump workers later if you isolate per-test data.
  fullyParallel: false,
  workers: 1,

  // Retry once in CI to absorb transient backend hiccups; never retry locally
  // so failures stay loud.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
