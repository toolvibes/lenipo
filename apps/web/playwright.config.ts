import { defineConfig } from '@playwright/test';

/**
 * End-to-end accessibility check (P-GEN-03, TL-43, E-124): the built app against a fresh
 * database, axe-core on the main pages. Locally it uses the installed Chrome, in CI the
 * Chromium that Playwright installs.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:4180',
    storageState: 'e2e/.state/auth.json',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
});
