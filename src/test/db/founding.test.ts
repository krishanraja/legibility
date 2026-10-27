// A3 acceptance tests: the Founding 200 page's database side, against every migration applied
// to a real Postgres (see ./supabase-stub.ts).
import { PGlite } from "@electric-sql/pglite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildExport, type RawRows } from "@/lib/api/growth-export";
import { FOUNDING_LIMITS, ipHash } from "@/lib/api/founding";
import { validateSnapshot } from "../vendor/growth-legibility/wire.mjs";
import { migratedDatabase } from "./supabase-stub";

// Synthetic only: documentation-range IPs, a low-entropy key, invented domains.
const KEY = "k".repeat(40);
const IP_A = ipHash("192.0.2.1", KEY);
const IP_B = ipHash("192.0.2.2", KEY);
const L = FOUNDING_LIMITS;

const dir = mkdtempSync(join(tmpdir(), "founding-db-"));
let db: PGlite;

afterAll(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeAll(async () => {
  db = await migratedDatabase(dir);
}, 60_000);

beforeEach(async () => {
  await db.exec(
    "DELETE FROM public.founding_entries; DELETE FROM public.founding_runs; DELETE FROM public.founding_page_views; DELETE FROM public.growth_events; DELETE FROM public.internal_accounts; DELETE FROM auth.users;",
  );
});

type Claim = { allowed: boolean; reason: string; run_id: string | null };

async function claim(ip: string, domain: string | null, cost = L.costCeilingUsdPerDay) {
  const { rows } = await db.query<Claim>(
    "SELECT * FROM public.claim_founding_run($1, $2, $3, $4, $5, $6)",
    [ip, domain, L.perIpPerDay, L.perDomainPerDay, L.runsPerDay, cost],
  );
  return rows[0];
}

async function entry(over: Record<string, unknown> = {}): Promise<string> {
  const e = {
    use_case: "A comparison agent",
    interface: "rest",
    stores: "Shopify",
    input_kind: "url",
    input: "https://shop.example/p",
    real_input: true,
    trusted: true,
    ...over,
  };
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.founding_entries (use_case, interface, stores, input_kind, input, real_input, trusted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [e.use_case, e.interface, e.stores, e.input_kind, e.input, e.real_input, e.trusted],
  );
  return rows[0].id;
}

async function signUp(meta: Record<string, unknown>, verified: boolean): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auth.users (raw_user_meta_data, email_confirmed_at)
     VALUES ($1::jsonb, CASE WHEN $2 THEN now() END) RETURNING id`,
    [JSON.stringify(meta), verified],
  );
  return rows[0].id;
}

describe("A3: limits", () => {
  it("2. the run past the per-IP limit is refused, and the limit survives a restart", async () => {
    for (let i = 0; i < L.perIpPerDay - 1; i++)
      expect((await claim(IP_A, null)).allowed).toBe(true);

    // A restart: the database is closed and opened again from disk. Nothing in the app holds
    // a count, so the limits are exactly what the database says.
    await db.close();
    db = new PGlite(dir);
    expect((await claim(IP_A, null)).allowed).toBe(true);
    expect(await claim(IP_A, null)).toEqual({ allowed: false, reason: "ip_limit", run_id: null });
    expect((await claim(IP_B, null)).allowed).toBe(true);
  });

  it("2. the run past the per-domain limit is refused, whoever runs it", async () => {
    for (let i = 0; i < L.perDomainPerDay; i++) {
      expect((await claim(ipHash(`198.51.100.${i}`, KEY), "shop.example")).allowed).toBe(true);
    }
    expect((await claim(IP_A, "shop.example")).reason).toBe("domain_limit");
    expect((await claim(IP_A, "other.example")).allowed).toBe(true);
  });

  it("4. at the daily cost ceiling, runs stop, and the cost is the worker's own", async () => {
    const first = await claim(IP_A, null);
    await db.query("SELECT public.complete_founding_run($1, 'done', $2)", [
      first.run_id,
      L.costCeilingUsdPerDay,
    ]);
    expect(await claim(IP_B, null)).toEqual({
      allowed: false,
      reason: "cost_ceiling",
      run_id: null,
    });
    // A completed run is final: completing it again changes nothing.
    await db.query("SELECT public.complete_founding_run($1, 'done', 0)", [first.run_id]);
    expect((await claim(IP_B, null)).reason).toBe("cost_ceiling");
  });

  it("the daily run count stops everyone once reached", async () => {
    const { rows } = await db.query<Claim>(
      "SELECT * FROM public.claim_founding_run($1, NULL, 100, 100, 1, 3)",
      [IP_A],
    );
    expect(rows[0].allowed).toBe(true);
    const again = await db.query<Claim>(
      "SELECT * FROM public.claim_founding_run($1, NULL, 100, 100, 1, 3)",
      [IP_B],
    );
    expect(again.rows[0].reason).toBe("daily_runs");
  });

  it("stores only a hash of the IP", async () => {
    await claim(IP_A, null);
    await expect(
      db.query("INSERT INTO public.founding_runs (ip_hash) VALUES ('192.0.2.1')"),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("A3: events", () => {
  it("beta_page_viewed is counted once per hashed IP per day, with its label", async () => {
    const view = async (ip: string, source: string) =>
      (
        await db.query<{ v: boolean }>("SELECT public.record_founding_view($1, $2) AS v", [
          ip,
          source,
        ])
      ).rows[0].v;
    expect(await view(IP_A, "invitation")).toBe(true);
    expect(await view(IP_A, "invitation")).toBe(false);
    expect(await view(IP_B, "Not A Label")).toBe(true);
    const { rows } = await db.query<{ source: string }>(
      "SELECT source FROM public.growth_events WHERE type = 'beta_page_viewed' ORDER BY source",
    );
    expect(rows.map((r) => r.source)).toEqual(["direct", "invitation"]);
  });
});

describe("A3: linking an entry to its account", () => {
  it("links at sign-up through metadata, once, to one account", async () => {
    const id = await entry();
    const account = await signUp({ founding_entry: id }, false);
    const { rows } = await db.query<{ account_id: string }>(
      "SELECT account_id FROM public.founding_entries WHERE id = $1",
      [id],
    );
    expect(rows[0].account_id).toBe(account);
    const other = await signUp({}, true);
    const claimed = await db.query<{ c: boolean }>(
      "SELECT public.claim_founding_entry($1, $2) AS c",
      [id, other],
    );
    expect(claimed.rows[0].c).toBe(false);
    const same = await db.query<{ c: boolean }>("SELECT public.claim_founding_entry($1, $2) AS c", [
      id,
      account,
    ]);
    expect(same.rows[0].c).toBe(true);
  });

  it("an existing account claims after verification; an entry over seven days old is not claimed", async () => {
    const fresh = await entry();
    const account = await signUp({}, true);
    expect(
      (
        await db.query<{ c: boolean }>("SELECT public.claim_founding_entry($1, $2) AS c", [
          fresh,
          account,
        ])
      ).rows[0].c,
    ).toBe(true);
    const old = await entry();
    await db.query(
      "UPDATE public.founding_entries SET created_at = now() - interval '8 days' WHERE id = $1",
      [old],
    );
    expect(
      (
        await db.query<{ c: boolean }>("SELECT public.claim_founding_entry($1, $2) AS c", [
          old,
          account,
        ])
      ).rows[0].c,
    ).toBe(false);
  });

  it("a malformed entry id never stops a sign-up", async () => {
    const account = await signUp({ founding_entry: "not-a-uuid" }, false);
    expect(account).toMatch(/^[0-9a-f-]{36}$/);
    await signUp({ founding_entry: "0f8fad5b-d9cb-469f-a165-70867728950e" }, false);
  });
});

describe("A3: qualification in the export", () => {
  it("8. the engine counts none of: unverified, no use case, no real input, internal", async () => {
    const unverified = await signUp({ founding_entry: await entry() }, false);
    const noUseCase = await signUp({ founding_entry: await entry({ use_case: "" }) }, true);
    const demoOnly = await signUp(
      {
        founding_entry: await entry({
          input_kind: "gtin",
          input: "8076800195057",
          real_input: false,
        }),
      },
      true,
    );
    const internal = await signUp({ founding_entry: await entry() }, true);
    await db.query(
      "INSERT INTO public.internal_accounts (account_id, class) VALUES ($1, 'testbench')",
      [internal],
    );
    const qualified = await signUp({ founding_entry: await entry() }, true);

    const now = new Date(Date.now() + 1000);
    const start = new Date(now.getTime() - 86_400_000);
    const rows = (
      await db.query<{ r: RawRows }>("SELECT public.growth_export_rows($1, $2, $3) AS r", [
        start.toISOString(),
        now.toISOString(),
        now.toISOString(),
      ])
    ).rows[0].r;
    const e = buildExport({
      rows,
      counts: {
        accounts: rows.accounts.length,
        reads: rows.reads.length,
        events: rows.events.length,
      },
      start,
      end: now,
      capturedAt: now,
      appRevision: "unknown",
      idKey: KEY,
      fields: { attribution: false },
    });
    const byRaw = new Map(rows.accounts.map((a, i) => [a.id, e.accounts[i]]));
    expect(byRaw.get(unverified)).toMatchObject({ email_verified: false });
    expect(byRaw.get(noUseCase)).toMatchObject({ email_verified: true, use_case: "" });
    expect(byRaw.get(demoOnly)).toMatchObject({ relevant_context: false });
    expect(byRaw.get(internal)).toMatchObject({ is_internal: true });
    expect(byRaw.get(qualified)).toMatchObject({
      email_verified: true,
      use_case: "A comparison agent",
      relevant_context: true,
      is_internal: false,
    });
    // The input the builders typed never leaves the app.
    expect(JSON.stringify(e)).not.toContain("shop.example");
    expect(JSON.stringify(e)).not.toContain("8076800195057");

    const snapshot = {
      schema_version: "1.0.0",
      snapshot_id: `app-export-${e.captured_at}`,
      mode: e.mode,
      captured_at: e.captured_at,
      app_revision: e.app_revision,
      window: e.window,
      coverage: {
        ...e.coverage,
        billing: false,
        partners: false,
        spend: false,
        feedback: false,
        candidates: false,
        opportunities: false,
      },
      icp: { status: "missing" },
      accounts: e.accounts,
      reads: e.reads,
      events: e.events,
      settlements: e.settlements,
      billing: [],
      partners: [],
      spend: { paid_media_usd: 0 },
      feedback: [],
      benchmark: { selection_method: "none", consented: false },
      suppressions: [],
      candidates: [],
      opportunities: [],
    };
    expect(() => validateSnapshot(snapshot, e.captured_at)).not.toThrow();
  });
});

describe("A3: access", () => {
  it("anonymous and signed-in roles can touch none of it", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      for (const sql of [
        "SELECT * FROM public.founding_entries",
        "SELECT * FROM public.founding_runs",
        "SELECT * FROM public.founding_page_views",
        `SELECT * FROM public.claim_founding_run('${IP_A}', NULL, 5, 20, 200, 3)`,
        `SELECT public.record_founding_view('${IP_A}', 'direct')`,
        "SELECT public.claim_founding_entry(gen_random_uuid(), gen_random_uuid())",
      ]) {
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      }
      await db.exec("RESET ROLE");
    }
  });
});
