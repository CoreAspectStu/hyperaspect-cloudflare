import { defineConfig } from "vitest/config";

/**
 * Vitest config for the HyperFrames Cloudflare app.
 *
 * Runs gateway/route-handler unit tests in a Node environment. The App Router
 * route handlers import `next/server` (NextRequest/NextResponse) and the
 * Node-standard fetch/Headers/Response globals, so no jsdom is required.
 *
 * Run: `pnpm test` (or `pnpm test:watch`).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
