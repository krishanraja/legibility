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
        // Global floor, pinned at the actuals measured by CI run 31131343100.
        //
        // Every file inside the `include` above is now fully covered, so the floor is 100.
        // Read it as "nothing in the money-path surface ships untested": adding a new file
        // under src/lib/api/ without tests fails the build immediately, which is the point.
        //
        // Phase 2 widens `include` to the route handlers (src/routes/api/v1/*). That will
        // drop the measured global below 100 on the first run. When it does, re-pin these
        // to the NEW measured actuals and let them climb from there. Do not pre-emptively
        // lower them now in anticipation.
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
