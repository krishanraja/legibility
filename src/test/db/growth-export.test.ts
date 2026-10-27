// A4 acceptance tests: the export, built from a seeded database with every migration applied
// (see ./supabase-stub.ts), composed into the engine's snapshot exactly as the brief does, and
// validated by the engine's own validator, vendored at a pinned commit.
import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { INTERNAL_CLASSES } from "@/lib/api/internal-accounts";
import { buildExport, type Counts, type ExportFields, type RawRows } from "@/lib/api/growth-export";
import { validateSnapshot } from "../vendor/growth-legibility/wire.mjs";
import { makeKey, migratedDatabase } from "./supabase-stub";

// growth-legibility main at the time of writing, and the sha256 its contracts/manifest.json
// records for src/guards/wire.mjs at that commit.
const WIRE_COMMIT = "4b48b8cfa8abab60653fed813a6dd8cba1759743";
const WIRE_SHA256 = "356b9260ed83f95a4cf3218ea17973b09341329a106a07ad69e766b997207d73";

// Synthetic: low-entropy test key, invented invitation, no people, no addresses.
const ID_KEY = "x".repeat(40);
const INV = "legibility:wave-1:synthetic.0001";
const START = new Date("2026-09-29T00:00:00.000Z");
const END = new Date("2026-11-03T05:00:00.000Z");
const CAPTURED = new Date("2026-11-03T05:00:00.000Z");
const REVISION = "0".repeat(40);

let db: PGlite;
const ids: Record<string, string> = {};

async function account(meta: unknown, createdAt: string, verified = true): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auth.users (raw_user_meta_data, created_at, email_confirmed_at)
     VALUES ($1::jsonb, $2, $3) RETURNING id`,
    [JSON.stringify(meta), createdAt, verified ? createdAt : null],
  );
  return rows[0].id;
}

async function read(
  acct: string,
  key: string | null,
  at: string,
  endpoint = "/api/v1/read_product",
  extra: { confidence?: number | null; product?: boolean; calibration?: string | null } = {},
) {
  await db.query(
    `INSERT INTO public.usage_events (user_id, api_key_id, tool, endpoint, product_returned,
       confidence, calibration_version, billable, cost_usd, method, status, created_at)
     VALUES ($1, $2, 'read_product', $3, $4, $5, $6, $7, 0.001, 'jsonld', 200, $8)`,
    [
      acct,
      key,
      endpoint,
      extra.product ?? true,
      extra.confidence === undefined ? 0.91 : extra.confidence,
      extra.calibration === undefined ? "cal-synthetic" : extra.calibration,
      (extra.product ?? true) && (extra.confidence ?? 0.91) >= 0.7,
      at,
    ],
  );
}

async function exportOnce(fields: ExportFields = { attribution: false }, end = END) {
  const range = [START.toISOString(), end.toISOString(), CAPTURED.toISOString()];
  const c = (
    await db.query<{ accounts: string; reads: string; events: string }>(
      "SELECT * FROM public.growth_export_counts($1, $2, $3)",
      range,
    )
  ).rows[0];
  const counts: Counts = {
    accounts: Number(c.accounts),
    reads: Number(c.reads),
    events: Number(c.events),
  };
  const rows = (
    await db.query<{ r: RawRows }>("SELECT public.growth_export_rows($1, $2, $3) AS r", range)
  ).rows[0].r;
  return buildExport({
    rows,
    counts,
    start: START,
    end,
    capturedAt: CAPTURED,
    appRevision: REVISION,
    idKey: ID_KEY,
    fields,
  });
}

/** The brief's composition, verbatim in substance. */
function compose(e: ReturnType<typeof buildExport>) {
  return {
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
}

beforeAll(async () => {
  db = await migratedDatabase();
  await db.exec("SET TIME ZONE 'America/New_York'");

  // One account per internal class, each with a trusted read.
  for (const cls of INTERNAL_CLASSES) {
    const a = await account({}, "2026-10-01T09:00:00Z");
    const k = await makeKey(db, a);
    await db.query("INSERT INTO public.internal_accounts (account_id, class) VALUES ($1, $2)", [
      a,
      cls,
    ]);
    await read(a, k, "2026-10-29T10:00:00Z");
    ids[`internal_${cls}`] = a;
  }

  // An invited builder: enrolment touch, a key with a touch, trusted reads over two days,
  // one with microseconds, and a dashboard-style testbench read.
  const touch = {
    invitation_id: INV,
    utm_source: "outreach",
    utm_medium: "email",
    utm_campaign: "wave-1",
    referrer_host: null,
    directory: null,
    touched_at: new Date(Date.now() - 60_000).toISOString(),
  };
  const builder = await account({ attribution: touch }, "2026-10-28T10:00:00Z");
  const key = await makeKey(db, builder);
  await db.query("UPDATE public.api_keys SET created_at = '2026-10-28T10:05:00Z' WHERE id = $1", [
    key,
  ]);
  await db.query("SELECT public.record_key_creation($1, $2::jsonb)", [key, JSON.stringify(touch)]);
  await db.query("SELECT public.record_key_client($1, 'curl')", [key]);
  await db.query("SELECT * FROM public.record_email_verified($1)", [builder]);
  await read(builder, key, "2026-10-30T11:00:00.123456Z");
  await read(builder, key, "2026-11-01T09:00:00Z", "/api/mcp");
  await read(builder, key, "2026-10-30T12:00:00Z", "testbench");
  await read(builder, key, "2026-10-30T12:30:00Z", "/api/v1/read_product", {
    confidence: null,
    product: false,
    calibration: null,
  });
  ids.builder = builder;
  ids.key = key;

  // A direct, unverified account with no key and no reads.
  ids.direct = await account({}, "2026-10-31T08:00:00Z", false);
}, 60_000);

describe("A4: the export", () => {
  it("1. the vendored validator is the pinned commit's", () => {
    const bytes = readFileSync(resolve(__dirname, "../vendor/growth-legibility/wire.mjs"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(WIRE_SHA256);
    expect(WIRE_COMMIT).toMatch(/^[0-9a-f]{40}$/);
  });

  it("1. the engine's own validator accepts the composed snapshot", async () => {
    const e = await exportOnce();
    expect(() => validateSnapshot(compose(e), e.captured_at)).not.toThrow();
    expect(e.accounts).toHaveLength(INTERNAL_CLASSES.length + 2);
    expect(e.reads).toHaveLength(INTERNAL_CLASSES.length + 4);
  });

  it("1. an extra key on an account, or a microsecond instant, is refused by the validator", async () => {
    const e = await exportOnce();
    const extra = compose(e);
    extra.accounts = [{ ...e.accounts[0], unexpected: true } as never, ...e.accounts.slice(1)];
    expect(() => validateSnapshot(extra, e.captured_at)).toThrow(/unknown_fields_account/);
    const micro = compose(e);
    micro.reads = [{ ...e.reads[0], occurred_at: "2026-10-30T11:00:00.123456Z" }];
    expect(() => validateSnapshot(micro, e.captured_at)).toThrow(/invalid_contract/);
  });

  it("2. two exports of the same window give the same ids", async () => {
    const a = await exportOnce();
    const b = await exportOnce();
    expect(a.accounts.map((x) => x.id)).toEqual(b.accounts.map((x) => x.id));
    expect(a.reads.map((x) => [x.id, x.session_id])).toEqual(
      b.reads.map((x) => [x.id, x.session_id]),
    );
    expect(a.events.map((x) => x.id)).toEqual(b.events.map((x) => x.id));
  });

  it("3. every internal account exports is_internal, and testbench reads export as testbench", async () => {
    const e = await exportOnce();
    const internal = e.accounts.filter((a) => a.is_internal);
    expect(internal).toHaveLength(INTERNAL_CLASSES.length);
    expect(internal.every((a) => a.acquisition_source === "internal")).toBe(true);
    expect(e.reads.map((r) => r.interface).sort()).toEqual(
      [...Array(INTERNAL_CLASSES.length + 2).fill("api"), "mcp", "testbench"].sort(),
    );
  });

  it("4. every timestamp is a UTC instant with at most millisecond precision", async () => {
    const e = await exportOnce();
    const instants = [
      e.captured_at,
      e.window.start,
      e.window.end,
      ...e.accounts.flatMap((a) => [a.enrolled_at, a.api_key_created_at]),
      ...e.reads.map((r) => r.occurred_at),
      ...e.events.map((x) => x.occurred_at),
    ].filter((v): v is string => v !== null);
    for (const v of instants) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(e.reads.some((r) => r.occurred_at === "2026-10-30T11:00:00.123Z")).toBe(true);
  });

  it("6. a scan finds no address, no IP, no key value or prefix, and no database id", async () => {
    const e = await exportOnce({ attribution: true });
    const text = JSON.stringify(e);
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/(^|[^0-9])\d{1,3}(\.\d{1,3}){3}([^0-9]|$)/);
    expect(text).not.toContain("lgk_");
    // The fixture keys' prefix is the literal "synthetic".
    expect(text).not.toContain('"synthetic"');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    for (const id of Object.values(ids)) expect(text).not.toContain(id);
    const { rows } = await db.query<{ id: string }>("SELECT id::text FROM public.usage_events");
    for (const r of e.reads) for (const row of rows) expect(r.id).not.toBe(row.id);
  });

  it("7. coverage.reads is false when the reconciliation counts differ", async () => {
    const e = await exportOnce();
    expect(e.coverage.reads).toBe(true);
    expect(e.reconciliation).toEqual({
      reads_metered: e.reads.length,
      reads_exported: e.reads.length,
    });
    const rows = (
      await db.query<{ r: RawRows }>("SELECT public.growth_export_rows($1, $2, $3) AS r", [
        START.toISOString(),
        END.toISOString(),
        CAPTURED.toISOString(),
      ])
    ).rows[0].r;
    const short = buildExport({
      rows: { ...rows, reads: rows.reads.slice(1) },
      counts: {
        accounts: rows.accounts.length,
        reads: rows.reads.length,
        events: rows.events.length,
      },
      start: START,
      end: END,
      capturedAt: CAPTURED,
      appRevision: REVISION,
      idKey: ID_KEY,
      fields: { attribution: false },
    });
    expect(short.coverage.reads).toBe(false);
    expect(short.reconciliation.reads_metered - short.reconciliation.reads_exported).toBe(1);
  });

  it("8. with fields=attribution the fields appear exactly as specified; without them they are absent", async () => {
    const plain = await exportOnce();
    expect(plain.accounts.every((a) => !("attribution" in a))).toBe(true);
    expect(plain.reads.every((r) => !("key_id" in r))).toBe(true);

    const e = await exportOnce({ attribution: true });
    const builderId = e.reads.find((r) => r.interface === "mcp")?.account_id;
    const b = e.accounts.find((a) => a.id === builderId) as (typeof e.accounts)[number] & {
      attribution: { enrolment: Record<string, unknown>; first_key: Record<string, unknown> };
    };
    const KEYS = [
      "invitation_id",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "referrer_host",
      "directory",
      "client",
      "touched_at",
    ];
    expect(Object.keys(b.attribution)).toEqual(["enrolment", "first_key"]);
    expect(Object.keys(b.attribution.enrolment)).toEqual(KEYS);
    expect(Object.keys(b.attribution.first_key)).toEqual(KEYS);
    expect(b.attribution.enrolment).toMatchObject({ invitation_id: INV, client: null });
    expect(b.attribution.first_key).toMatchObject({ invitation_id: INV, client: "curl" });
    expect(b.acquisition_source).toBe("invitation");
    expect(e.reads.every((r) => /^key_[0-9a-f]{64}$/.test(String(r.key_id)))).toBe(true);
    const direct = e.accounts.find((a) => a.acquisition_source === "direct") as {
      attribution: unknown;
    };
    expect(direct.attribution).toEqual({ enrolment: null, first_key: null });

    // Today the engine's validator refuses these fields, which is why they wait behind the
    // parameter until a growth-legibility commit accepts them (Phase 1B).
    expect(() => validateSnapshot(compose(e), e.captured_at)).toThrow(/unknown_fields_account/);
  });

  it("carries events only server-side, with the account's label", async () => {
    const e = await exportOnce();
    expect(e.events.map((x) => x.type).sort()).toEqual(["email_verified", "key_created"]);
    expect(e.events.every((x) => x.source === "invitation")).toBe(true);
    expect(e.coverage.events).toBe(false);
    expect(e.coverage.settlements).toBe(false);
    expect(e.settlements).toEqual([]);
  });

  it("leaves out reads after the window and keeps the account's first key date", async () => {
    const e = await exportOnce({ attribution: false }, new Date("2026-10-30T11:30:00.000Z"));
    expect(e.reads.every((r) => r.occurred_at < "2026-10-30T11:30:00.000Z")).toBe(true);
    const b = e.accounts.find((a) => a.api_key_created_at === "2026-10-28T10:05:00.000Z");
    expect(b?.enrolled_at).toBe("2026-10-28T10:00:00.000Z");
    expect(e.accounts.find((a) => a.email_verified === false)?.api_key_created_at).toBeNull();
  });

  it("anonymous and signed-in roles cannot call the export functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await expect(
        db.query("SELECT public.growth_export_rows(now() - interval '1 day', now(), now())"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query(
          "SELECT * FROM public.growth_export_counts(now() - interval '1 day', now(), now())",
        ),
      ).rejects.toThrow(/permission denied/);
      await db.exec("RESET ROLE");
    }
  });
});
