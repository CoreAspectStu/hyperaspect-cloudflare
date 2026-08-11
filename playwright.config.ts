import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the studio e2e tests (create → register → edit).
 *
 * These are DEV e2e tests — they need the dev server (:3200) and the render
 * farm (the generate + register paths reach the farm filesystem). They are not
 * intended for CI without that environment.
 *
 * Uses the system Chrome (channel:'chrome') so no browser download is needed on
 * machines that already have Chrome; otherwise run `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // generation hits the farm — don't parallelise
  workers: 1,
  timeout: 5 * 60 * 1000, // generation takes ~90s + render; allow generous headroom
  expect: { timeout: 30_000 },
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    // Use Playwright's bundled Chromium (the system Chrome under @playwright/test
    // leaves the SPA unmounted). --no-sandbox is required in this environment.
    headless: true,
    actionTimeout: 30_000,
    launchOptions: { args: ["--no-sandbox", "--disable-gpu"] },
    screenshot: "only-on-failure",
  },
});
