// A1 acceptance tests: the internal list and northstar_weekly_keys, run against every
// migration in the repository applied to a real Postgres (see ./supabase-stub.ts).
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { INTERNAL_CLASSES } from "@/lib/api/internal-accounts";
import {
  MIGRATIONS_DIR,
  makeAccount,
  makeKey,
  makeRead,
  migratedDatabase,
  migrationFiles,
} from "./supabase-stub";

type KeyRow = { iso_week: string; week_start: Date; key_id: string; trusted_reads: number };

let db: PGlite;

beforeAll(async () => {
  db = await migratedDatabase();
}, 60_000);

beforeEach(async () => {
  // A non-UTC session, so every week boundary below proves the functions are UTC on their own.
  await db.exec("RESET ROLE; SET TIME ZONE 'Pacific/Auckland';");
  await db.exec(
    "DELETE FROM public.usage_events; DELETE FROM public.internal_keys; DELETE FROM public.internal_accounts; DELETE FROM public.api_keys; DELETE FROM auth.users;",
  );
});

async function keysForWeek(week: string): Promise<KeyRow[]> {
  const { rows } = await db.query<KeyRow>("SELECT * FROM public.northstar_weekly_keys($1::date)", [
    week,
  ]);
  return rows;
}

async function markInternal(accountId: string, cls: string) {
  await db.query("INSERT INTO public.internal_accounts (account_id, class) VALUES ($1, $2)", [
    accountId,
    cls,
  ]);
}

describe("A1: the internal list", () => {
  it("1. one account per internal class and two external builders: exactly the two external keys", async () => {
    for (const cls of INTERNAL_CLASSES) {
      const acct = await makeAccount(db);
      const key = await makeKey(db, acct);
      await markInternal(acct, cls);
      await db.query("INSERT INTO public.internal_keys (key_id, class) VALUES ($1, $2)", [
        key,
        cls,
      ]);
      await makeRead(db, acct, key, { at: "2026-11-03T10:00:00Z" });
    }
    // An internal account whose key has no label of its own is still excluded.
    const unlabelled = await makeAccount(db);
    const unlabelledKey = await makeKey(db, unlabelled);
    await markInternal(unlabelled, "krish");
    await makeRead(db, unlabelled, unlabelledKey, { at: "2026-11-03T10:00:00Z" });

    const builderA = await makeAccount(db);
    const keyA = await makeKey(db, builderA);
    const builderB = await makeAccount(db);
    const keyB = await makeKey(db, builderB);
    await makeRead(db, builderA, keyA, { at: "2026-11-02T09:00:00Z" });
    await makeRead(db, builderA, keyA, { at: "2026-11-04T09:00:00Z" });
    await makeRead(db, builderB, keyB, { at: "2026-11-08T23:00:00Z", endpoint: "/api/mcp" });

    const rows = await keysForWeek("2026-11-02");
    expect(rows.map((r) => r.key_id).sort()).toEqual([keyA, keyB].sort());
    expect(rows.find((r) => r.key_id === keyA)?.trusted_reads).toBe(2);
    expect(rows.find((r) => r.key_id === keyB)?.trusted_reads).toBe(1);
    expect(new Set(rows.map((r) => r.iso_week))).toEqual(new Set(["2026-W45"]));
  });

  it("2. Sunday 23:59:59.999 UTC and Monday 00:00:00 UTC land in different ISO weeks; 28 Dec 2026 is 2026-W53", async () => {
    const acct = await makeAccount(db);
    const key = await makeKey(db, acct);
    await makeRead(db, acct, key, { at: "2026-11-01T23:59:59.999Z" });
    await makeRead(db, acct, key, { at: "2026-11-02T00:00:00Z" });
    await makeRead(db, acct, key, { at: "2026-12-28T12:00:00Z" });

    const before = await keysForWeek("2026-10-26");
    const after = await keysForWeek("2026-11-02");
    expect(before).toHaveLength(1);
    expect(before[0].iso_week).toBe("2026-W44");
    expect(before[0].trusted_reads).toBe(1);
    expect(after).toHaveLength(1);
    expect(after[0].iso_week).toBe("2026-W45");
    expect(after[0].trusted_reads).toBe(1);

    // Any day of the week selects that week; the row names its Monday.
    const last = await keysForWeek("2026-12-31");
    expect(last).toHaveLength(1);
    expect(last[0].iso_week).toBe("2026-W53");
    const { rows } = await db.query<{ d: string }>(
      "SELECT to_char(week_start, 'YYYY-MM-DD') AS d FROM public.northstar_weekly_keys('2026-12-31')",
    );
    expect(rows[0].d).toBe("2026-12-28");
  });

  it("2b. the default argument is this ISO week", async () => {
    const acct = await makeAccount(db);
    const key = await makeKey(db, acct);
    await db.query(
      `INSERT INTO public.usage_events (user_id, api_key_id, tool, endpoint, product_returned,
         confidence, calibration_version, billable, created_at)
       VALUES ($1, $2, 'read_product', '/api/v1/read_product', true, 0.9, 'synthetic-cal', true, now())`,
      [acct, key],
    );
    const { rows } = await db.query<KeyRow>("SELECT * FROM public.northstar_weekly_keys()");
    expect(rows.map((r) => r.key_id)).toEqual([key]);
  });

  it("3. below the gate, no product, no calibration version, or a testbench read adds nothing", async () => {
    const acct = await makeAccount(db);
    const key = await makeKey(db, acct);
    const at = "2026-11-03T10:00:00Z";
    await makeRead(db, acct, key, { at, confidence: 0.69 });
    await makeRead(db, acct, key, { at, product: false });
    await makeRead(db, acct, key, { at, product: null });
    await makeRead(db, acct, key, { at, confidence: null });
    await makeRead(db, acct, key, { at, calibration: null });
    await makeRead(db, acct, key, { at, calibration: "  " });
    await makeRead(db, acct, key, { at, endpoint: "testbench" });
    await makeRead(db, acct, key, { at, endpoint: "/dashboard/quickstart" });
    await makeRead(db, acct, key, { at, endpoint: null });
    expect(await keysForWeek("2026-11-02")).toEqual([]);

    // The gate is inclusive: exactly 0.7 is trusted.
    await makeRead(db, acct, key, { at, confidence: 0.7 });
    const rows = await keysForWeek("2026-11-02");
    expect(rows).toHaveLength(1);
    expect(rows[0].trusted_reads).toBe(1);
  });

  it("3b. read_interface classifies every metered endpoint", async () => {
    const { rows } = await db.query<{ e: string | null; i: string }>(
      `SELECT e, public.read_interface(e) AS i FROM (VALUES
         ('/api/mcp'), ('/api/v1/read_product'), ('/api/v1/compare_products'),
         ('testbench'), ('/api/mcp/x'), (NULL)) AS t(e)`,
    );
    expect(rows.map((r) => r.i)).toEqual([
      "mcp",
      "api",
      "api",
      "testbench",
      "testbench",
      "testbench",
    ]);
  });

  it("4. recording an internal key on an account that is not internal is refused", async () => {
    const external = await makeAccount(db);
    const externalKey = await makeKey(db, external);
    await expect(
      db.query("INSERT INTO public.internal_keys (key_id, class) VALUES ($1, 'engine')", [
        externalKey,
      ]),
    ).rejects.toThrow(/internal_key_on_external_account/);

    // Nor can a recorded key be moved onto one by update.
    const internal = await makeAccount(db);
    const internalKey = await makeKey(db, internal);
    await markInternal(internal, "engine");
    await db.query("INSERT INTO public.internal_keys (key_id, class) VALUES ($1, 'engine')", [
      internalKey,
    ]);
    await expect(
      db.query("UPDATE public.internal_keys SET key_id = $1 WHERE key_id = $2", [
        externalKey,
        internalKey,
      ]),
    ).rejects.toThrow(/internal_key_on_external_account/);

    // Taking the account off the list takes its key labels with it, so the rule cannot be
    // broken from the other side.
    await db.query("DELETE FROM public.internal_accounts WHERE account_id = $1", [internal]);
    const { rows } = await db.query("SELECT 1 FROM public.internal_keys WHERE key_id = $1", [
      internalKey,
    ]);
    expect(rows).toEqual([]);
  });

  it("4b. an unknown class is refused", async () => {
    const acct = await makeAccount(db);
    await expect(markInternal(acct, "friend")).rejects.toThrow(/check constraint/);
  });

  it("5. anonymous and signed-in roles can neither read the two tables nor call the function", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT * FROM public.internal_accounts")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("SELECT * FROM public.internal_keys")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("SELECT * FROM public.northstar_weekly_keys()")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("SELECT * FROM public.northstar_weekly()")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query(
          "INSERT INTO public.internal_accounts (account_id, class) VALUES (gen_random_uuid(), 'ci')",
        ),
      ).rejects.toThrow(/permission denied/);
      await db.exec("RESET ROLE");
    }

    // The service role, which is what the app's server uses, can do all of it.
    const acct = await makeAccount(db);
    await db.exec("SET ROLE service_role");
    await db.query("INSERT INTO public.internal_accounts (account_id, class) VALUES ($1, 'ci')", [
      acct,
    ]);
    const { rows } = await db.query("SELECT * FROM public.internal_accounts");
    expect(rows).toHaveLength(1);
    await db.query("SELECT * FROM public.northstar_weekly_keys()");
    await db.query("SELECT * FROM public.northstar_weekly()");
    await db.exec("RESET ROLE");
  });

  it("6. northstar_weekly keeps its signature and default, and now excludes internal accounts", async () => {
    const { rows: sig } = await db.query<{ args: string; result: string }>(
      `SELECT pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'northstar_weekly'`,
    );
    expect(sig).toHaveLength(1);
    expect(sig[0].args).toBe(
      "_since timestamp with time zone DEFAULT (now() - '56 days'::interval)",
    );
    expect(sig[0].result).toBe(
      "TABLE(user_id uuid, week date, trusted_reads bigint, total_calls bigint)",
    );

    const builder = await makeAccount(db);
    const builderKey = await makeKey(db, builder);
    const krish = await makeAccount(db);
    const krishKey = await makeKey(db, krish);
    await markInternal(krish, "krish");
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await makeRead(db, builder, builderKey, { at: recent });
    await makeRead(db, builder, builderKey, { at: recent, confidence: 0.2 });
    await makeRead(db, krish, krishKey, { at: recent });

    // Called the way getMetrics calls it: no argument.
    const { rows } = await db.query<{
      user_id: string;
      trusted_reads: number;
      total_calls: number;
    }>("SELECT * FROM public.northstar_weekly()");
    expect(rows.map((r) => r.user_id)).toEqual([builder]);
    expect(Number(rows[0].trusted_reads)).toBe(1);
    expect(Number(rows[0].total_calls)).toBe(2);
  });

  it("6b. northstar_weekly_keys has the agreed shape", async () => {
    const { rows } = await db.query<{ args: string; result: string }>(
      `SELECT pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'northstar_weekly_keys'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].args).toMatch(/^_week_start date DEFAULT/);
    expect(rows[0].result).toBe(
      "TABLE(iso_week text, week_start date, key_id uuid, trusted_reads integer)",
    );
  });
});

describe("A1: privacy of the files", () => {
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/;
  const KEY_VALUE = /lgk_[A-Za-z0-9_-]{8,}/;

  const files: [string, string][] = [
    ...migrationFiles().map(
      (f) =>
        [`supabase/migrations/${f}`, readFileSync(resolve(MIGRATIONS_DIR, f), "utf8")] as [
          string,
          string,
        ],
    ),
    ...readdirSync(__dirname).map(
      (f) => [`src/test/db/${f}`, readFileSync(resolve(__dirname, f), "utf8")] as [string, string],
    ),
  ];

  it.each(files)("7. %s holds no email address or key value", (_name, text) => {
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(KEY_VALUE);
  });
});
