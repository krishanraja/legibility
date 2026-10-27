import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  EVENTS_COVERED,
  MAX_ROWS_PER_SECTION,
  appRevision,
  buildExport,
  failureReason,
  opaqueId,
  parseWindow,
  tokenMatches,
  tooManyRows,
  type RawRows,
} from "./growth-export";

// Synthetic only: an invented token and a low-entropy id key.
const TOKEN = "synthetic-export-token";
const TOKEN_SHA = createHash("sha256").update(TOKEN).digest("hex");
const KEY = "k".repeat(40);
const NOW = new Date("2026-11-03T05:00:00.000Z");

const q = (s: string) => new URLSearchParams(s);

describe("parseWindow", () => {
  it("accepts a window in UTC instants, with or without milliseconds", () => {
    const w = parseWindow(q("start=2026-09-29T00:00:00Z&end=2026-11-03T05:00:00.000Z"), NOW);
    expect(w).toEqual({
      ok: true,
      start: new Date("2026-09-29T00:00:00Z"),
      end: NOW,
      fields: { attribution: false },
    });
  });

  it("5. refuses a missing, malformed, reversed, future or over-92-day window", () => {
    const bad = [
      "",
      "start=2026-10-01&end=2026-10-02",
      "start=2026-10-01T00:00:00+01:00&end=2026-10-02T00:00:00Z",
      "start=2026-10-01T00:00:00.123456Z&end=2026-10-02T00:00:00Z",
      "start=2026-02-30T00:00:00Z&end=2026-10-02T00:00:00Z",
      "start=2026-13-01T00:00:00Z&end=2026-10-02T00:00:00Z",
      "start=2026-10-02T00:00:00Z&end=2026-10-01T00:00:00Z",
      "start=2026-10-02T00:00:00Z&end=2026-10-02T00:00:00Z",
      "start=2026-11-01T00:00:00Z&end=2026-11-03T05:00:00.001Z",
      "start=2026-08-02T00:00:00Z&end=2026-11-03T00:00:00Z",
    ];
    for (const s of bad) {
      const w = parseWindow(q(s), NOW);
      expect(w.ok, s).toBe(false);
      if (!w.ok) expect(w.error).toBe("invalid_window");
    }
    expect(parseWindow(q("start=2026-08-03T00:00:00Z&end=2026-11-03T00:00:00Z"), NOW).ok).toBe(
      true,
    );
  });

  it("reads fields=attribution and refuses any other field set", () => {
    const base = "start=2026-10-01T00:00:00Z&end=2026-10-02T00:00:00Z";
    const w = parseWindow(q(`${base}&fields=attribution`), NOW);
    expect(w.ok && w.fields.attribution).toBe(true);
    const bad = parseWindow(q(`${base}&fields=attribution,emails`), NOW);
    expect(bad).toMatchObject({ ok: false, error: "invalid_fields" });
  });
});

describe("tokenMatches", () => {
  it("accepts the token whose sha256 is configured, in either case of hex", () => {
    expect(tokenMatches(`Bearer ${TOKEN}`, TOKEN_SHA)).toBe(true);
    expect(tokenMatches(`Bearer  ${TOKEN} `, TOKEN_SHA.toUpperCase())).toBe(true);
  });

  it("5. refuses a missing, wrong or non-Bearer token, and everything when unconfigured", () => {
    expect(tokenMatches(null, TOKEN_SHA)).toBe(false);
    expect(tokenMatches("Bearer ", TOKEN_SHA)).toBe(false);
    expect(tokenMatches(`Basic ${TOKEN}`, TOKEN_SHA)).toBe(false);
    expect(tokenMatches("Bearer wrong", TOKEN_SHA)).toBe(false);
    expect(tokenMatches(`Bearer ${TOKEN}`, undefined)).toBe(false);
    expect(tokenMatches(`Bearer ${TOKEN}`, "")).toBe(false);
    expect(tokenMatches(`Bearer ${TOKEN}`, "not-a-hash")).toBe(false);
    // The configured value is the hash, so presenting the hash itself does not work.
    expect(tokenMatches(`Bearer ${TOKEN_SHA}`, TOKEN_SHA)).toBe(false);
  });
});

describe("opaqueId", () => {
  it("is stable, prefixed, keyed and fits the engine's id pattern", () => {
    const a = opaqueId("acct", "row-1", KEY);
    expect(a).toBe(opaqueId("acct", "row-1", KEY));
    expect(a).toMatch(/^acct_[0-9a-f]{64}$/);
    expect(a).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/);
    expect(opaqueId("acct", "row-1", "j".repeat(40))).not.toBe(a);
    expect(opaqueId("read", "row-1", KEY).slice(5)).not.toBe(a.slice(5));
    expect(a).not.toContain("row-1");
  });
});

describe("small rules", () => {
  it("tooManyRows is over the per-section limit in any section", () => {
    const ok = { accounts: MAX_ROWS_PER_SECTION, reads: 0, events: 0 };
    expect(tooManyRows(ok)).toBe(false);
    expect(tooManyRows({ ...ok, accounts: MAX_ROWS_PER_SECTION + 1 })).toBe(true);
    expect(tooManyRows({ ...ok, reads: MAX_ROWS_PER_SECTION + 1 })).toBe(true);
    expect(tooManyRows({ ...ok, events: MAX_ROWS_PER_SECTION + 1 })).toBe(true);
  });

  it("failureReason names an HTTP failure, a missing product or a below-gate read", () => {
    expect(failureReason({ status: 502, product_present: false }, 0)).toBe("http_502");
    expect(failureReason({ status: 200, product_present: false }, 0)).toBe("no_product");
    expect(failureReason({ status: 200, product_present: true }, 0.69)).toBe("below_gate");
    expect(failureReason({ status: 200, product_present: true }, 0.7)).toBeNull();
  });

  it("appRevision is the deployed commit or a plain marker", () => {
    expect(appRevision({ VERCEL_GIT_COMMIT_SHA: "a".repeat(40) })).toBe("a".repeat(40));
    expect(appRevision({ VERCEL_GIT_COMMIT_SHA: "main" })).toBe("unknown");
    expect(appRevision({})).toBe("unknown");
  });
});

describe("buildExport", () => {
  const rows: RawRows = {
    accounts: [
      {
        id: "acct-row",
        email_verified: true,
        is_internal: false,
        enrolled_at: "2026-10-28T10:00:00.000Z",
        api_key_created_at: null,
        acquisition_source: "Not A Label",
        enrolment_touch: null,
        first_key_touch: null,
      },
      {
        id: "acct-row-2",
        email_verified: false,
        is_internal: false,
        enrolled_at: "2026-10-28T10:00:00.000Z",
        api_key_created_at: "2026-10-28T10:05:00.000Z",
        acquisition_source: "introduction",
        // An address built at run time, so none is written into this file.
        use_case: `A comparison agent; reach me at ${["me", "example.invalid"].join("@")} or https://x.example/p/1`,
        relevant_context: true,
        enrolment_touch: {
          invitation_id: "legibility:x",
          utm_source: "outreach",
          utm_medium: "introduction",
          utm_campaign: null,
          referrer_host: null,
          directory: null,
          client: "never-on-an-enrolment",
          touched_at: "2026-10-28T09:58:00.000Z",
        },
        first_key_touch: {
          invitation_id: "legibility:x",
          utm_source: "outreach",
          utm_medium: "introduction",
          utm_campaign: null,
          referrer_host: null,
          directory: null,
          client: "curl",
          touched_at: "2026-10-28T10:04:00.000Z",
        },
      },
    ],
    reads: [
      {
        id: 7,
        account_id: "acct-row",
        key_id: null,
        occurred_at: "2026-10-30T11:00:00.000Z",
        utc_date: "2026-10-30",
        interface: "something-else",
        product_present: true,
        confidence: "1.5",
        calibration_version: null,
        cost_usd: "-1",
        method: null,
        status: 200,
      },
      {
        id: 8,
        account_id: "acct-row",
        key_id: "key-row",
        occurred_at: "2026-10-30T11:00:00.000Z",
        utc_date: "2026-10-30",
        interface: "mcp",
        product_present: true,
        confidence: null,
        calibration_version: "cal",
        cost_usd: null,
        method: "jsonld",
        status: 200,
      },
      {
        id: 9,
        account_id: "acct-row",
        key_id: null,
        occurred_at: "2026-10-30T11:00:00.000Z",
        utc_date: "2026-10-30",
        interface: "api",
        product_present: true,
        confidence: "not a number",
        calibration_version: "cal",
        cost_usd: "abc",
        method: "jsonld",
        status: 200,
      },
      {
        id: 10,
        account_id: "acct-row-2",
        key_id: null,
        occurred_at: "2026-10-30T11:00:00.000Z",
        utc_date: "2026-10-30",
        interface: "api",
        product_present: true,
        confidence: 0.91,
        calibration_version: "cal",
        cost_usd: "0.004",
        method: "jsonld",
        status: 200,
      },
    ],
    events: [
      {
        id: "evt-row",
        type: "key_created",
        account_id: null,
        occurred_at: "2026-10-30T11:00:00.000Z",
        source: "direct",
      },
      {
        id: "evt-row-2",
        type: "email_verified",
        account_id: "acct-row-2",
        occurred_at: "2026-10-30T11:00:00.000Z",
        source: "introduction",
      },
    ],
  };
  const input = {
    rows,
    counts: { accounts: 2, reads: 4, events: 2 },
    start: new Date("2026-10-01T00:00:00Z"),
    end: NOW,
    capturedAt: NOW,
    appRevision: "unknown",
    idKey: KEY,
    fields: { attribution: true },
  };

  it("normalises every value the engine checks", () => {
    const e = buildExport(input);
    expect(e.accounts[0].acquisition_source).toBe("unattributed");
    expect(e.reads[0]).toMatchObject({
      interface: "testbench",
      confidence: 1,
      cost_usd: 0,
      calibration_version: "",
      method: "unknown",
      key_id: null,
    });
    expect(e.reads[1]).toMatchObject({ confidence: 0, cost_usd: 0, failure_reason: "below_gate" });
    expect(e.reads[1].key_id).toMatch(/^key_[0-9a-f]{64}$/);
    expect(e.reads[2]).toMatchObject({ confidence: 0, cost_usd: 0 });
    // Reads without a key fall back to the account for their session; with one, the key.
    expect(e.reads[0].session_id).toBe(e.reads[2].session_id);
    expect(e.reads[1].session_id).not.toBe(e.reads[0].session_id);
    expect(e.events[0].account_id).toBeNull();
    expect(e.events[1].account_id).toBe(e.accounts[1].id);
    expect(e.reads[3]).toMatchObject({ cost_usd: 0.004, failure_reason: null });
  });

  it("A3: carries the use case, scrubbed, and whether the builder ran a real input", () => {
    const e = buildExport(input);
    expect(e.accounts[0]).toMatchObject({ use_case: "", relevant_context: false });
    expect(e.accounts[1]).toMatchObject({
      use_case: "A comparison agent; reach me at [removed] or [removed]",
      relevant_context: true,
    });
  });

  it("attribution: an enrolment touch never carries a client; the first key's does", () => {
    const e = buildExport(input);
    const a = e.accounts[1] as { attribution?: Record<string, Record<string, unknown> | null> };
    expect(a.attribution?.enrolment).toMatchObject({ client: null, invitation_id: "legibility:x" });
    expect(a.attribution?.first_key).toMatchObject({ client: "curl" });
    const plain = buildExport({ ...input, fields: { attribution: false } });
    expect("attribution" in plain.accounts[1]).toBe(false);
    expect("key_id" in plain.reads[1]).toBe(false);
  });

  it("vouches for a section only when its counts reconcile, and never for events or settlements yet", () => {
    const e = buildExport(input);
    expect(e.coverage).toEqual({
      accounts: true,
      reads: true,
      events: EVENTS_COVERED,
      settlements: false,
    });
    expect(EVENTS_COVERED).toBe(false);
    expect(buildExport({ ...input, eventsCovered: true }).coverage.events).toBe(true);
    const off = buildExport({ ...input, counts: { accounts: 3, reads: 5, events: 2 } });
    expect(off.coverage).toMatchObject({ accounts: false, reads: false });
    expect(off.window.complete).toBe(true);
  });
});
