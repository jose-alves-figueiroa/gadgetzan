import { defineConfig, devices } from "@playwright/test";
import { TEST_DATABASE_URL } from "./e2e/env";

// A dedicated port, distinct from the app's normal :3000 (local dev / the
// docker-compose `app` service), so this never collides with — or silently
// reuses — a server pointed at the real database.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // The 10 flows share cumulative state on one fixed test user (global-setup
  // seeds one user/categories, flow 1 creates the account/salary the rest
  // build on) — they must run in file order, not fanned out across workers.
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    // Production mode, not `next dev`: Turbopack's dev-mode HMR/Fast Refresh
    // was observed racing next-auth's client-side CSRF handshake (the cookie
    // and the posted csrfToken would intermittently diverge), failing login
    // unpredictably. Slower to start, but matches how the app actually runs
    // (Docker) and removes that whole class of flake.
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse whatever's already on this port — it must be the server
    // this config just started against TEST_DATABASE_URL, not a stray
    // process pointed at the real database.
    reuseExistingServer: false,
    // The build step alone can take well past Playwright's 60s default.
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "e2e-test-secret-not-for-production-use",
      // next-auth v4 reads this exact name (not the docs' old AUTH_URL, now
      // renamed NEXTAUTH_URL) to know its own canonical origin — without it,
      // it falls back to a hardcoded :3000 default and rejects credentials
      // callbacks from any other port as a host mismatch (see e2e/README.md).
      NEXTAUTH_URL: `http://localhost:${PORT}`,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
