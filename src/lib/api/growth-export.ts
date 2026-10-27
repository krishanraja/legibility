// A4: the row-level export for the growth engine (growth-legibility), shaped exactly to its
// contract (src/guards/wire.mjs, validateSnapshot). Every object is closed: an extra key makes
// the engine refuse the whole snapshot, so nothing here adds a field the contract does not name.
//
// Rules this file holds:
//   - every database id becomes an opaque HMAC-SHA-256 id under EXPORT_ID_KEY, stable across
//     exports, with a prefix (acct_, key_, read_, evt_, sess_);
//   - every instant is a UTC instant at millisecond precision (the database truncates);
//   - unknown stays unknown: a section the app cannot vouch for says coverage false, never an
//     empty list that reads as zero;
//   - never in the export: an email address, a name, an IP, a product input, a key value or
//     prefix, a wallet address, a User-Agent, a Stripe id or a database id.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { scrubFreeText } from "@/lib/api/founding";

export const EXPORT_VERSION = "1.0.0";
export const MAX_WINDOW_DAYS = 92;
export const MAX_ROWS_PER_SECTION = 100_000;
export const MAX_BYTES = 20 * 1024 * 1024;
/** The minimum length of EXPORT_ID_KEY. A short key would make the opaque ids guessable. */
export const MIN_ID_KEY_LENGTH = 32;

/**
 * The events section holds email_verified and key_created (A2) and the Founding 200 page's
 * beta_page_viewed, testbench_started, testbench_completed and founding_200_submitted (A3). The
 * engine also counts bounces, complaints, unsubscribes and referral enrolments, which the app
 * does not record, so it cannot vouch for the section. It stays false until those are recorded.
 */
export const EVENTS_COVERED = false;

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const LABEL = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const DAY_MS = 86_400_000;

export type ExportFields = { attribution: boolean };

export type WindowResult =
  | { ok: true; start: Date; end: Date; fields: ExportFields }
  | { ok: false; error: string; message: string };

function instant(value: string | null): Date | null {
  if (!value || !UTC_INSTANT.test(value)) return null;
  const d = new Date(value);
  // A calendar date that does not exist (30 February) parses into another day; refuse it.
  const normalised = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(d.getTime()) && d.toISOString() === normalised ? d : null;
}

/** The request's window and fields, or why it is refused (a 400). */
export function parseWindow(params: URLSearchParams, now: Date): WindowResult {
  const start = instant(params.get("start"));
  const end = instant(params.get("end"));
  if (!start || !end) {
    return {
      ok: false,
      error: "invalid_window",
      message: "start and end must be UTC instants (YYYY-MM-DDTHH:MM:SS[.sss]Z).",
    };
  }
  if (start.getTime() >= end.getTime()) {
    return { ok: false, error: "invalid_window", message: "start must be before end." };
  }
  if (end.getTime() > now.getTime()) {
    return { ok: false, error: "invalid_window", message: "end must not be in the future." };
  }
  if (end.getTime() - start.getTime() > MAX_WINDOW_DAYS * DAY_MS) {
    return {
      ok: false,
      error: "invalid_window",
      message: `The window must be at most ${MAX_WINDOW_DAYS} days.`,
    };
  }
  const requested = params.getAll("fields").flatMap((f) => f.split(","));
  if (requested.some((f) => f !== "attribution")) {
    return {
      ok: false,
      error: "invalid_fields",
      message: "The only optional field set is attribution.",
    };
  }
  return { ok: true, start, end, fields: { attribution: requested.includes("attribution") } };
}

/**
 * Whether the Authorization header carries the export token. The app holds only the token's
 * SHA-256 (GROWTH_EXPORT_TOKEN_SHA256), compared in constant time. No hash configured means
 * no token can match, so the route is off until it is set and off again when it is removed.
 */
export function tokenMatches(authorization: string | null, expectedSha256: string | undefined) {
  if (!expectedSha256 || !SHA256_HEX.test(expectedSha256.toLowerCase())) return false;
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (!token) return false;
  const presented = createHash("sha256").update(token).digest();
  return timingSafeEqual(presented, Buffer.from(expectedSha256.toLowerCase(), "hex"));
}

/** An opaque id: the prefix and the HMAC-SHA-256 of the kind and the row id. */
export function opaqueId(prefix: string, raw: string | number, key: string): string {
  return `${prefix}_${createHmac("sha256", key).update(`${prefix}:${raw}`).digest("hex")}`;
}

export type RawTouch = {
  invitation_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  directory: string | null;
  client: string | null;
  touched_at: string;
};

export type RawAccount = {
  id: string;
  email_verified: boolean;
  is_internal: boolean;
  enrolled_at: string;
  api_key_created_at: string | null;
  acquisition_source: string;
  /** A3: from the latest linked Founding 200 entry; absent before A3's migration. */
  use_case?: string;
  relevant_context?: boolean;
  enrolment_touch: RawTouch | null;
  first_key_touch: RawTouch | null;
};

export type RawRead = {
  id: string | number;
  account_id: string;
  key_id: string | null;
  occurred_at: string;
  utc_date: string;
  interface: string;
  product_present: boolean;
  confidence: number | string | null;
  calibration_version: string | null;
  cost_usd: number | string | null;
  method: string | null;
  status: number;
};

export type RawEvent = {
  id: string;
  type: string;
  account_id: string | null;
  occurred_at: string;
  source: string;
};

export type RawSettlement = {
  id: string;
  occurred_at: string;
  network: "base-sepolia" | "base-mainnet";
  status: "settled" | "failed";
  payer: "agent" | "human";
  amount_usd: number | string;
};

export type RawRows = {
  accounts: RawAccount[];
  reads: RawRead[];
  events: RawEvent[];
  /** A5: x402 payments in the window. */
  settlements?: RawSettlement[];
};
export type Counts = { accounts: number; reads: number; events: number; settlements?: number };

/** Whether a window is over the size limit before any row is read (a 413). */
export function tooManyRows(counts: Counts): boolean {
  return (
    counts.accounts > MAX_ROWS_PER_SECTION ||
    counts.reads > MAX_ROWS_PER_SECTION ||
    counts.events > MAX_ROWS_PER_SECTION ||
    (counts.settlements ?? 0) > MAX_ROWS_PER_SECTION
  );
}

/** A short failure code for a read, or null when it returned a trusted-looking product. */
export function failureReason(
  read: Pick<RawRead, "status" | "product_present">,
  confidence: number,
) {
  if (read.status >= 400) return `http_${read.status}`;
  if (!read.product_present) return "no_product";
  if (confidence < 0.7) return "below_gate";
  return null;
}

function unit(value: number | string | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function money(value: number | string | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** The label as the engine reads it; anything malformed is unattributed, never dropped. */
function label(value: string): string {
  return LABEL.test(value) ? value : "unattributed";
}

function touch(t: RawTouch | null, withClient: boolean) {
  if (!t) return null;
  return {
    invitation_id: t.invitation_id,
    utm_source: t.utm_source,
    utm_medium: t.utm_medium,
    utm_campaign: t.utm_campaign,
    referrer_host: t.referrer_host,
    directory: t.directory,
    client: withClient ? t.client : null,
    touched_at: t.touched_at,
  };
}

export type BuildInput = {
  rows: RawRows;
  counts: Counts;
  start: Date;
  end: Date;
  capturedAt: Date;
  appRevision: string;
  idKey: string;
  fields: ExportFields;
  /** Whether the app vouches for the events section; EVENTS_COVERED unless a test says. */
  eventsCovered?: boolean;
  /** A5: when x402 calls began to be recorded (capture_sources); null means not yet. */
  settlementsSince?: Date | null;
};

/** The export body, exactly the engine's contract (plus attribution only when asked). */
export function buildExport(input: BuildInput) {
  const { rows, idKey, fields } = input;
  const acct = (id: string) => opaqueId("acct", id, idKey);

  const accounts = rows.accounts.map((a) => ({
    id: acct(a.id),
    email_verified: a.email_verified,
    // What the builder typed on the Founding 200 page, with anything that looks like an
    // address, a URL, an IP or a barcode removed; and whether they ran a real input.
    use_case: scrubFreeText(a.use_case ?? ""),
    relevant_context: a.relevant_context === true,
    is_internal: a.is_internal,
    enrolled_at: a.enrolled_at,
    api_key_created_at: a.api_key_created_at,
    acquisition_source: label(a.acquisition_source),
    // True only with deployment evidence the owner has reviewed and keeps; there is none yet.
    production_agent: false,
    ...(fields.attribution
      ? {
          attribution: {
            enrolment: touch(a.enrolment_touch, false),
            first_key: touch(a.first_key_touch, true),
          },
        }
      : {}),
  }));

  const reads = rows.reads.map((r) => {
    const confidence = unit(r.confidence);
    // No MCP session ids exist (the server is stateless), so a session is the key and the UTC
    // date, hashed. A read whose key was deleted falls back to its account.
    const sessionOf = r.key_id
      ? `key:${r.key_id}:${r.utc_date}`
      : `acct:${r.account_id}:${r.utc_date}`;
    return {
      id: opaqueId("read", r.id, idKey),
      account_id: acct(r.account_id),
      occurred_at: r.occurred_at,
      interface: r.interface === "api" || r.interface === "mcp" ? r.interface : "testbench",
      product_present: r.product_present,
      confidence,
      calibration_version: r.calibration_version ?? "",
      cost_usd: money(r.cost_usd),
      method: r.method ?? "unknown",
      failure_reason: failureReason(r, confidence),
      session_id: opaqueId("sess", sessionOf, idKey),
      ...(fields.attribution ? { key_id: r.key_id ? opaqueId("key", r.key_id, idKey) : null } : {}),
    };
  });

  const events = rows.events.map((e) => ({
    id: opaqueId("evt", e.id, idKey),
    type: e.type,
    account_id: e.account_id ? acct(e.account_id) : null,
    occurred_at: e.occurred_at,
    source: label(e.source),
  }));

  const settlements = (rows.settlements ?? []).map((x) => ({
    id: opaqueId("stl", x.id, idKey),
    occurred_at: x.occurred_at,
    network: x.network,
    status: x.status,
    payer: x.payer,
    amount_usd: money(x.amount_usd),
  }));
  // Settlements are vouched for only for a window that starts after x402 calls began to be
  // recorded, and only when every row counted was exported.
  const since = input.settlementsSince ?? null;
  const settlementsComplete =
    since !== null &&
    input.start.getTime() >= since.getTime() &&
    (input.counts.settlements ?? 0) === settlements.length;

  // Metering is best-effort, so the reads are reconciled: the rows counted before the read
  // against the rows exported. Any difference and the section is not vouched for.
  const readsComplete = input.counts.reads === reads.length;
  const accountsComplete = input.counts.accounts === accounts.length;

  return {
    export_version: EXPORT_VERSION,
    mode: "live" as const,
    captured_at: input.capturedAt.toISOString(),
    app_revision: input.appRevision,
    window: {
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      // Every section the export carries was read in full: a window too large for one
      // response is refused (413), never truncated.
      complete: true,
    },
    coverage: {
      accounts: accountsComplete,
      reads: readsComplete,
      events: (input.eventsCovered ?? EVENTS_COVERED) && input.counts.events === events.length,
      settlements: settlementsComplete,
    },
    reconciliation: { reads_metered: input.counts.reads, reads_exported: reads.length },
    accounts,
    reads,
    events,
    settlements,
  };
}

/** The deployed commit, from the platform, or a plain marker when it is not known. */
export function appRevision(env: Record<string, string | undefined>): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : "unknown";
}
