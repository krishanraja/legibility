import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MCP_ERRORS,
  NO_SUBSCRIPTION_PER_MINUTE,
  RATE_LIMITS,
  RATE_WINDOW_SECONDS,
  REST_ERRORS,
} from "./api-reference";

// The public /docs/errors and /docs/rate-limits pages render these facts. These tests hold
// them to the sources that decide the behaviour, so the pages cannot drift from the API again.

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const migrations = readdirSync(resolve(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`))
  .join("\n");

const v1 = readdirSync(resolve(root, "src/routes/api/v1"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => read(`src/routes/api/v1/${f}`));
const restSources = [
  ...v1,
  read("src/lib/api/http.ts"),
  read("src/integrations/supabase/entitlement.server.ts"),
].join("\n");
const mcp = read("src/routes/api/mcp.ts");

describe("rate limits match the database", () => {
  it("each plan's per-minute budget is plans.rate_per_sec * 60 from the seed", () => {
    const seed = /INSERT INTO public\.plans \(([^)]+)\) VALUES([\s\S]*?);/.exec(migrations);
    expect(seed).not.toBeNull();
    const cols = seed![1].split(",").map((c) => c.trim());
    const rateIdx = cols.indexOf("rate_per_sec");
    const rows = [...seed![2].matchAll(/\('([a-z]+)',([^\n]*)\)/g)].map((m) => {
      const values = [`'${m[1]}'`, ...m[2].split(",").map((v) => v.trim())];
      return { id: m[1], rate: Number(values[rateIdx]) };
    });
    expect(rows.map((r) => r.id).sort()).toEqual(RATE_LIMITS.map((r) => r.planId).sort());
    for (const r of rows) {
      expect(RATE_LIMITS.find((x) => x.planId === r.id)?.perMinute).toBe(r.rate * 60);
    }
    // No later migration may change a plan's rate without this file changing too.
    expect(migrations.match(/rate_per_sec\s*=/g) ?? []).toEqual([]);
  });

  it("the fallback and window match rate_check()", () => {
    expect(migrations).toContain("rate_per_sec, 1) * 60");
    expect(migrations).toContain(`per_min := ${NO_SUBSCRIPTION_PER_MINUTE};`);
    expect(migrations).toContain(`interval '${RATE_WINDOW_SECONDS} seconds'`);
    expect(migrations).toMatch(new RegExp(`per_min, ${RATE_WINDOW_SECONDS};`));
  });
});

describe("errors match the API", () => {
  it("every REST error code the API emits is documented", () => {
    const emitted = new Set(
      [...restSources.matchAll(/error: "([a-z_]+)"/g)].map((m) => m[1]).concat(["cost_fuse"]),
    );
    const documented = new Set(REST_ERRORS.map((r) => r.error));
    expect([...emitted].filter((c) => !documented.has(c))).toEqual([]);
  });

  it("every documented REST error is emitted with the documented status", () => {
    for (const r of REST_ERRORS) {
      expect(restSources, r.error).toContain(`"${r.error}"`);
      expect(restSources, `${r.error} ${r.status}`).toMatch(new RegExp(String(r.status)));
    }
  });

  it("MCP JSON-RPC codes match the server both ways", () => {
    const emitted = new Set([...mcp.matchAll(/-32\d{3}/g)].map((m) => Number(m[0])));
    expect([...emitted].sort()).toEqual(MCP_ERRORS.map((r) => r.code).sort());
  });
});
