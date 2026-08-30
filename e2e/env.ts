// Shared between playwright.config.ts (webServer) and global-setup.ts, so
// both agree on which database the app under test talks to. Deliberately a
// separate Postgres database from local dev's `gadgetzan` — e2e truncates
// tables between runs, which must never touch real data.
export const TEST_DB_NAME = "gadgetzan_test";
export const TEST_DATABASE_URL =
  process.env.PLAYWRIGHT_DATABASE_URL ?? `postgres://gadgetzan:changeme@localhost:5432/${TEST_DB_NAME}`;
export const TEST_ADMIN_DATABASE_URL =
  process.env.PLAYWRIGHT_ADMIN_DATABASE_URL ?? "postgres://gadgetzan:changeme@localhost:5432/postgres";

export const TEST_USER = {
  email: "e2e@example.com",
  password: "E2ePassword123!",
};
