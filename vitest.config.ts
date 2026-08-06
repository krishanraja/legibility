import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest shares Vite, which is already a dependency, so this adds no second build system.
// The app's own vite.config.ts is deliberately NOT reused: it loads the TanStack Start and
// Nitro plugins, which try to build routes and are not wanted in a unit-test run.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Truth tests hit the network and the live database, so they are opt-in via
    // `bun run test:truth` and excluded from the default unit run.
    exclude: ["**/node_modules/**", "src/test/truth/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/lib/api/**", "src/integrations/supabase/api-keys.server.ts"],
      exclude: ["**/*.test.ts", "src/lib/api/*.functions.ts"],
      // Money paths: these files decide what a customer is charged and who gets in.
      // Per docs/AUTONOMOUS-HARDENING-PLAN.md these are held at 100 percent.
      //
      // PROTECTED PATH. Lowering any threshold below is a guardrail trip, not a fix.
      // If a test fails, the assumption is that the code is wrong.
      thresholds: {
        "src/lib/api/stripe-signature.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/lib/api/meter.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        // Global floor, pinned at the actuals measured when this landed. It exists as a
        // ratchet: coverage can go up, never down. Phase 2 (route integration tests over
        // http.ts, x402.server.ts and api-keys.server.ts) raises these toward 80.
        lines: 47,
        branches: 55,
        functions: 28,
        statements: 49,
      },
    },
  },
});
