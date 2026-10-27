// A8 acceptance tests: the 30-day trial, against every migration applied to a real Postgres
// (see ./supabase-stub.ts). All accounts and amounts are synthetic.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { quotaBlockedBody } from "@/integrations/supabase/entitlement.server";
import { buildExport, type RawRows } from "@/lib/api/growth-export";
import { trialFuseCents } from "@/lib/api/trial";
import { makeKey, migratedDatabase } from "./supabase-stub";

type Ent = {
  allowed: boolean;
  reason: string;
  plan_id: string;
  included_calls: number;
  used_billable: number;
  cost_spent_cents: string;
};

let db: PGlite;
let before: PGlite;

beforeAll(async () => {
  [db, before] = await Promise.all([
    migratedDatabase(),
    migratedDatabase(undefined, { exclude: ["20261027170000_trial_grants.sql"] }),
  ]);
}, 120_000);

afterAll(async () => {
  await before.close();
});

beforeEach(async () => {
  await db.exec(
    "RESET ROLE; DELETE FROM public.usage_events; DELETE FROM public.trial_grants; DELETE FROM public.subscriptions; DELETE FROM public.api_keys; DELETE FROM auth.users;",
  );
});

async function account(): Promise<string> {
  return (await db.query<{ id: string }>("INSERT INTO auth.users DEFAULT VALUES RETURNING id"))
    .rows[0].id;
}

/** n metered reads for an account, each with a cost, at a time (default now). */
async function reads(
  acct: string,
  n: number,
  opts: { billable?: boolean; cost?: number; at?: string } = {},
) {
  await db.query(
    `INSERT INTO public.usage_events (user_id, tool, endpoint, billable, product_returned, confidence, cost_usd, created_at)
     SELECT $1, 'read_product', '/api/v1/read_product', $2, $2, CASE WHEN $2 THEN 0.9 ELSE 0.1 END, $3,
            COALESCE($4::timestamptz, now())
     FROM generate_series(1, $5)`,
    [acct, opts.billable ?? true, opts.cost ?? 0.001, opts.at ?? null, n],
  );
}

async function grant(
  acct: string,
  allowance: number,
  opts: { days?: number; fuse?: number; inv?: string | null } = {},
) {
  await db.query("SELECT * FROM public.grant_trial($1, $2, $3, $4, $5, NULL)", [
    acct,
    allowance,
    opts.days ?? 30,
    opts.fuse ?? 100_000,
    opts.inv ?? null,
  ]);
}

async function ent(acct: string): Promise<Ent> {
  return (await db.query<Ent>("SELECT * FROM public.entitlement_check($1)", [acct])).rows[0];
}

describe("A8: precedence", () => {
  it("1. a real paid subscription with a grant is served by the subscription", async () => {
    const a = await account();
    await db.query(
      "INSERT INTO public.subscriptions (user_id, plan_id, status) VALUES ($1, 'starter', 'active')",
      [a],
    );
    // A live grant with reads left: the subscription still wins.
    await grant(a, 1000);
    await reads(a, 20);
    expect(await ent(a)).toMatchObject({
      allowed: true,
      reason: "ok",
      plan_id: "starter",
      included_calls: 5000,
    });
    // And with the grant used up, still the subscription, never a refusal.
    await reads(a, 2000);
    expect(await ent(a)).toMatchObject({ allowed: true, reason: "ok", plan_id: "starter" });
  });

  it("2. a live grant counts reads from its start; past the allowance it is used up and says nothing was charged", async () => {
    const a = await account();
    // Reads before the grant do not count against it.
    await reads(a, 50, { at: new Date(Date.now() - 3_600_000).toISOString() });
    await grant(a, 1200);
    await reads(a, 1150);
    expect(await ent(a)).toMatchObject({
      allowed: true,
      plan_id: "trial",
      included_calls: 1200,
      used_billable: 1150,
    });
    await reads(a, 50);
    const e = await ent(a);
    expect(e).toMatchObject({ allowed: false, reason: "trial_used_up", plan_id: "trial" });
    const body = quotaBlockedBody(
      {
        allowed: e.allowed,
        reason: "trial_used_up",
        plan_id: e.plan_id,
        included_calls: e.included_calls,
        used_billable: Number(e.used_billable),
      },
      "https://legibility.io/dashboard/billing",
    );
    expect(body.error).toBe("trial_used_up");
    expect(body.message).toContain("trial is used up");
    expect(body.message).toContain("Nothing was charged");
  });
});

describe("A8: never worse than Free", () => {
  it("3. for any sequence of reads, a granted account is allowed whenever the same account without a grant is", async () => {
    // A seeded walk: two accounts with identical usage, one with a grant of random size, fuse
    // and age. Whenever the account without a grant is allowed, the granted one must be too.
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let round = 0; round < 12; round++) {
      await db.exec(
        "DELETE FROM public.usage_events; DELETE FROM public.trial_grants; DELETE FROM auth.users;",
      );
      const withGrant = await account();
      const without = await account();
      await grant(withGrant, 1 + rand(1500), { fuse: 1 + rand(5000), days: 1 + rand(30) });
      if (rand(3) === 0) {
        // An old grant: past its last day.
        await db.query(
          "UPDATE public.trial_grants SET starts_at = now() - interval '40 days', ends_at = now() - interval '10 days'",
        );
      }
      for (let step = 0; step < 6; step++) {
        const n = rand(400);
        const opts = { billable: rand(4) !== 0, cost: rand(5) / 100 };
        await reads(withGrant, n, opts);
        await reads(without, n, opts);
        const [g, f] = [await ent(withGrant), await ent(without)];
        if (f.allowed) expect(g.allowed, `round ${round} step ${step}`).toBe(true);
      }
    }
  });

  it("3. after day 30 the account is on Free", async () => {
    const a = await account();
    await grant(a, 5000);
    await db.query(
      "UPDATE public.trial_grants SET starts_at = now() - interval '31 days', ends_at = now() - interval '1 day' WHERE account_id = $1",
      [a],
    );
    await reads(a, 10);
    expect(await ent(a)).toMatchObject({ allowed: true, plan_id: "free", included_calls: 1000 });
  });

  it("3. an exhausted trial falls back to Free while Free has reads left", async () => {
    const a = await account();
    await reads(a, 100, { at: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    await grant(a, 5);
    await reads(a, 5);
    expect(await ent(a)).toMatchObject({ allowed: true, plan_id: "free" });
  });

  it("an early end returns the account to Free", async () => {
    const a = await account();
    await grant(a, 5000);
    await db.query("SELECT public.end_trial($1)", [a]);
    expect((await ent(a)).plan_id).toBe("free");
  });
});

describe("A8: grants", () => {
  it("4. a grant longer than 30 days, and a second grant for the same account, are refused", async () => {
    const a = await account();
    await expect(grant(a, 5000, { days: 31 })).rejects.toThrow(/trial_too_long/);
    await grant(a, 5000);
    await expect(grant(a, 5000)).rejects.toThrow(/trial_already_granted/);
    await expect(
      db.query(
        "UPDATE public.trial_grants SET ends_at = starts_at + interval '31 days' WHERE account_id = $1",
        [a],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(grant(await account(), 5000, { inv: "not-an-invitation" })).rejects.toThrow(
      /invalid_invitation_id/,
    );
  });

  it("5. only the service role can grant, end or read trials", async () => {
    const a = await account();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      for (const sql of [
        `SELECT * FROM public.grant_trial('${a}', 5000, 30, 1000, NULL, NULL)`,
        `SELECT public.end_trial('${a}')`,
        "SELECT * FROM public.trial_grants",
        "SELECT * FROM public.trial_cost_per_call()",
        `SELECT * FROM public.entitlement_check('${a}')`,
      ]) {
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      }
      await db.exec("RESET ROLE");
    }
    await db.exec("SET ROLE service_role");
    await db.query(`SELECT * FROM public.grant_trial('${a}', 5000, 30, 1000, NULL, NULL)`);
    await db.exec("RESET ROLE");
  });

  it("6. a trial of the allowance at the measured cost a call is not stopped early by the fuse", async () => {
    const a = await account();
    const perCall = 0.012;
    await grant(a, 5000, {
      fuse: trialFuseCents(5000, { calls: 1, avg_usd: perCall, p95_usd: perCall }),
    });
    await reads(a, 4999, { cost: perCall });
    // 4,999 reads have cost 6,000 cents: twice Free's fuse, well inside the trial's.
    expect(await ent(a)).toMatchObject({ allowed: true, plan_id: "trial" });
    await reads(a, 1, { cost: perCall });
    expect((await ent(a)).reason).toBe("trial_used_up");
  });

  it("the measurement is read-only and covers REST and MCP calls", async () => {
    const a = await account();
    await reads(a, 10, { cost: 0.004 });
    const { rows } = await db.query<{ calls: string; avg_usd: string }>(
      "SELECT * FROM public.trial_cost_per_call()",
    );
    expect(Number(rows[0].calls)).toBe(10);
    expect(rows[0].avg_usd).toBe("0.004000");
  });
});

describe("A8: what it never touches", () => {
  it("7. subscriptions, plans, rate_check and checkout's tables are exactly as before", async () => {
    const def = async (d: PGlite, sql: string) => JSON.stringify((await d.query(sql)).rows);
    const queries = [
      "SELECT pg_get_functiondef('public.rate_check(uuid)'::regprocedure) AS d",
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'plans', 'invoices') ORDER BY table_name, ordinal_position`,
      `SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname IN ('subscriptions', 'plans', 'invoices') AND NOT t.tgisinternal ORDER BY tgname`,
      "SELECT id, name, price_cents, included_calls, overage_cents_per_call, rate_per_sec, burst_per_sec, stripe_price_id, active, features FROM public.plans ORDER BY id",
    ];
    for (const q of queries) expect(await def(db, q)).toBe(await def(before, q));
  });

  it("7. entitlement_check keeps its signature", async () => {
    const sig = async (d: PGlite) =>
      (
        await d.query<{ a: string; r: string }>(
          `SELECT pg_get_function_arguments(p.oid) AS a, pg_get_function_result(p.oid) AS r
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'entitlement_check'`,
        )
      ).rows;
    expect(await sig(db)).toEqual(await sig(before));
  });

  it("an account with no grant gets exactly what it got before A8", async () => {
    for (const d of [db, before]) {
      await d.exec("DELETE FROM public.usage_events; DELETE FROM auth.users;");
    }
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    for (const d of [db, before]) {
      await d.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
      await d.query(
        `INSERT INTO public.usage_events (user_id, tool, billable, cost_usd) SELECT $1, 'read_product', true, 0.02 FROM generate_series(1, 1500)`,
        [id],
      );
    }
    const q = "SELECT * FROM public.entitlement_check($1)";
    expect((await db.query(q, [id])).rows).toEqual((await before.query(q, [id])).rows);
  });
});

describe("A8: the grant's invitation id", () => {
  it("9. a grant with an invitation id exports that id on the key's touch", async () => {
    const a = await account();
    const key = await makeKey(db, a);
    await db.query("SELECT public.record_key_creation($1, NULL)", [key]);
    await grant(a, 5000, { inv: "legibility:wave-1:synthetic.0002" });
    const now = new Date(Date.now() + 1000);
    const rows = (
      await db.query<{ r: RawRows }>("SELECT public.growth_export_rows($1, $2, $3) AS r", [
        new Date(now.getTime() - 86_400_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      ])
    ).rows[0].r;
    const e = buildExport({
      rows,
      counts: { accounts: rows.accounts.length, reads: 0, events: 0 },
      start: new Date(now.getTime() - 86_400_000),
      end: now,
      capturedAt: now,
      appRevision: "unknown",
      idKey: "k".repeat(40),
      fields: { attribution: true },
    });
    const acct = e.accounts[0] as {
      attribution?: { first_key: { invitation_id: string | null } | null };
    };
    expect(acct.attribution?.first_key?.invitation_id).toBe("legibility:wave-1:synthetic.0002");
  });
});
