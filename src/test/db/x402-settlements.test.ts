// A5 acceptance tests: the x402 ledger and its export, against every migration applied to a
// real Postgres (see ./supabase-stub.ts). All values are synthetic.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildExport, type RawRows, type RawSettlement } from "@/lib/api/growth-export";
import { settlementRow } from "@/lib/api/x402-ledger";
import { paymentRequirements } from "@/lib/api/x402.server";
import { validateSnapshot } from "../vendor/growth-legibility/wire.mjs";
import { migratedDatabase } from "./supabase-stub";

const REQS = paymentRequirements("https://legibility.io/api/mcp", "Legibility read_product");
const header = (nonceByte: string) =>
  Buffer.from(
    JSON.stringify({
      payload: { authorization: { nonce: `0x${nonceByte.repeat(32)}`, value: "10000" } },
    }),
  ).toString("base64");

let db: PGlite;

beforeAll(async () => {
  db = await migratedDatabase();
}, 60_000);

beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM public.x402_settlements;");
});

async function record(xPayment: string, ok: boolean, network = REQS.network) {
  const row = settlementRow(
    xPayment,
    { ...REQS, network },
    ok ? { ok } : { ok, reason: "insufficient_balance" },
    "read_product",
  );
  if (!row) return;
  await db.query("SELECT public.record_x402_settlement($1, $2, $3, $4, $5, $6, $7, $8)", [
    row._payment_id,
    row._network,
    row._status,
    row._amount_usd,
    row._usd_rate,
    row._rate_as_of,
    row._tool,
    row._failure_reason,
  ]);
}

async function rows() {
  return (
    await db.query<{ status: string; network: string; amount_usd: string; payer: string }>(
      "SELECT status, network, amount_usd, payer FROM public.x402_settlements ORDER BY occurred_at",
    )
  ).rows;
}

describe("A5: the ledger", () => {
  it("one test call on Base Sepolia writes exactly one row", async () => {
    await record(header("01"), true);
    expect(await rows()).toEqual([
      { status: "settled", network: "base-sepolia", amount_usd: "0.010000", payer: "agent" },
    ]);
  });

  it("a retried payment writes no second row", async () => {
    await record(header("02"), true);
    await record(header("02"), true);
    await record(header("02"), false);
    expect(await rows()).toHaveLength(1);
    expect((await rows())[0].status).toBe("settled");
  });

  it("a failed payment writes failed, and becomes settled if the same payment later settles", async () => {
    await record(header("03"), false);
    expect((await rows())[0].status).toBe("failed");
    await record(header("03"), true);
    expect(await rows()).toHaveLength(1);
    expect((await rows())[0].status).toBe("settled");
  });

  it("testnet amounts never appear as mainnet", async () => {
    await record(header("04"), true, "base-sepolia");
    await expect(
      db.query(
        "INSERT INTO public.x402_settlements (payment_id, network, status, amount_usd, usd_rate, rate_as_of) VALUES (repeat('a', 64), 'base', 'settled', 1, 1, '2026-10-27')",
      ),
    ).rejects.toThrow(/check constraint/);
    expect((await rows()).every((r) => r.network === "base-sepolia")).toBe(true);
  });

  it("anonymous and signed-in roles can neither read the ledger nor write to it", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT * FROM public.x402_settlements")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("SELECT * FROM public.capture_sources")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query(
          "SELECT public.record_x402_settlement(repeat('b', 64), 'base-sepolia', 'settled', 1, 1, '2026-10-27', NULL, NULL)",
        ),
      ).rejects.toThrow(/permission denied/);
      await db.exec("RESET ROLE");
    }
  });
});

describe("A5: settlements in the export", () => {
  it("exports the six keys, no wallet address, and coverage only from when capture began", async () => {
    await record(header("05"), true);
    await record(header("06"), false);
    const now = new Date(Date.now() + 1000);
    const start = new Date(now.getTime() - 3_600_000);
    const c = (
      await db.query<{ settlements: string; settlements_since: string }>(
        "SELECT * FROM public.growth_export_counts($1, $2, $3)",
        [start.toISOString(), now.toISOString(), now.toISOString()],
      )
    ).rows[0];
    const raw = (
      await db.query<{ r: RawRows }>("SELECT public.growth_export_rows($1, $2, $3) AS r", [
        start.toISOString(),
        now.toISOString(),
        now.toISOString(),
      ])
    ).rows[0].r;
    const settlements = (
      await db.query<{ s: RawSettlement[] }>(
        "SELECT public.growth_export_settlements($1, $2) AS s",
        [start.toISOString(), now.toISOString()],
      )
    ).rows[0].s;
    // Capture began when the migration ran, moments ago in this database.
    expect(c.settlements_since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const since = new Date(c.settlements_since);
    expect(Date.now() - since.getTime()).toBeLessThan(10 * 60_000);
    const build = (from: Date) =>
      buildExport({
        rows: { ...raw, settlements },
        counts: {
          accounts: raw.accounts.length,
          reads: raw.reads.length,
          events: raw.events.length,
          settlements: Number(c.settlements),
        },
        start: from,
        end: now,
        capturedAt: now,
        appRevision: "unknown",
        idKey: "k".repeat(40),
        fields: { attribution: false },
        settlementsSince: since,
      });

    // The capture began when the migration ran, so a window from then on is vouched for.
    const covered = build(since);
    expect(covered.coverage.settlements).toBe(true);
    expect(covered.settlements).toHaveLength(2);
    for (const x of covered.settlements) {
      expect(Object.keys(x).sort()).toEqual([
        "amount_usd",
        "id",
        "network",
        "occurred_at",
        "payer",
        "status",
      ]);
      expect(x.id).toMatch(/^stl_[0-9a-f]{64}$/);
      expect(x.network).toBe("base-sepolia");
    }
    expect(JSON.stringify(covered)).not.toMatch(/0x[0-9a-fA-F]{40}/);

    // A window that starts before capture began cannot be vouched for.
    const early = build(new Date(since.getTime() - 86_400_000));
    expect(early.coverage.settlements).toBe(false);

    const snapshot = {
      schema_version: "1.0.0",
      snapshot_id: `app-export-${covered.captured_at}`,
      mode: covered.mode,
      captured_at: covered.captured_at,
      app_revision: covered.app_revision,
      window: covered.window,
      coverage: {
        ...covered.coverage,
        billing: false,
        partners: false,
        spend: false,
        feedback: false,
        candidates: false,
        opportunities: false,
      },
      icp: { status: "missing" },
      accounts: covered.accounts,
      reads: covered.reads,
      events: covered.events,
      settlements: covered.settlements,
      billing: [],
      partners: [],
      spend: { paid_media_usd: 0 },
      feedback: [],
      benchmark: { selection_method: "none", consented: false },
      suppressions: [],
      candidates: [],
      opportunities: [],
    };
    expect(() => validateSnapshot(snapshot, covered.captured_at)).not.toThrow();
  });
});
