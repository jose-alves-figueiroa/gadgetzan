import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: "node",
    // e2e/ holds Playwright specs (`pnpm test:e2e`), not Vitest ones — keep the
    // two runners from fighting over *.spec.ts.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
