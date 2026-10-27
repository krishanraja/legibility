// A3: the run-first Founding 200 page. The rules, the words and the limits, in one place.
//
// A builder tries Legibility on one of their own products in two minutes with no signup. The
// result shows inline; only then are they asked for an email, which gets a fixed-template
// verification link and nothing they typed. After verification they get a key and the report.
//
// Until A8 (the 30-day trial) is live, every word here is what the Free plan allows: up to
// 1,000 trusted reads a month, no enforced end date, no unlimited use, no waived charges, no
// price. No booking link anywhere (Ruling, Krish, 2026-10-27: reply to book).
import { createHmac } from "node:crypto";

import { API_BASE, DEMO_GTIN, MCP_URL } from "@/config/product";
import type { Touch } from "@/lib/api/attribution";

/**
 * The limits, proposed for Krish's approval in the A3 pull request. Every one is counted in
 * the database (claim_founding_run), so a restart or a new instance resets none of them.
 * The ceiling is the worker's own cost: nothing is charged to anyone.
 */
export const FOUNDING_LIMITS = {
  perIpPerDay: 5,
  perDomainPerDay: 20,
  runsPerDay: 200,
  costCeilingUsdPerDay: 3,
} as const;

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type FoundingInput =
  | { kind: "url"; value: string; domain: string }
  | { kind: "gtin"; value: string; domain: null };

const GTIN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

/** One product page URL (http or https, a real host) or one barcode, or null. */
export function parseFoundingInput(raw: unknown): FoundingInput | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const digits = value.replace(/[\s-]/g, "");
  if (GTIN.test(digits)) return { kind: "gtin", value: digits, domain: null };
  if (value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!HOST.test(host) || !host.includes(".") || IPV4_HOST.test(host)) return null;
  return { kind: "url", value: url.toString(), domain: host };
}

/** A real input is the builder's own, not the demo barcode every sample uses. */
export function isRealInput(input: FoundingInput): boolean {
  return !(input.kind === "gtin" && input.value === DEMO_GTIN);
}

export type FoundingForm = {
  input: FoundingInput;
  use_case: string;
  interface: "rest" | "mcp";
  stores: string;
};

/** The form, validated, or a plain message saying what to fix. */
export function parseFoundingForm(
  body: Record<string, unknown>,
): { ok: true; form: FoundingForm } | { ok: false; message: string } {
  const input = parseFoundingInput(body.input);
  if (!input) return { ok: false, message: REFUSALS.invalid_input };
  const use_case = typeof body.use_case === "string" ? body.use_case.trim() : "";
  const stores = typeof body.stores === "string" ? body.stores.trim() : "";
  if (use_case.length > 2000 || stores.length > 500) {
    return { ok: false, message: "That is longer than we can keep. Shorten it and run again." };
  }
  const iface = body.interface === "mcp" ? "mcp" : "rest";
  return { ok: true, form: { input, use_case, interface: iface, stores } };
}

export type RefusalReason =
  | "ip_limit"
  | "domain_limit"
  | "daily_runs"
  | "cost_ceiling"
  | "challenge"
  | "paused"
  | "invalid_input";

/** Every refusal, in plain words. None mentions a price, and none charges anyone. */
export const REFUSALS: Record<RefusalReason, string> = {
  ip_limit: `You have run the test ${FOUNDING_LIMITS.perIpPerDay} times today. Come back tomorrow, or get a key below and keep going.`,
  domain_limit:
    "That site has been tested a lot today. Try a product from another site, or come back tomorrow.",
  daily_runs:
    "The test has reached its limit for today. Nothing has been charged to anyone. Come back tomorrow.",
  cost_ceiling:
    "The test has reached its limit for today. Nothing has been charged to anyone. Come back tomorrow.",
  challenge: "Complete the check that you are a person, then run the test again.",
  paused: "The test is paused right now. Nothing has been charged to anyone.",
  invalid_input:
    "Enter a product page URL (starting https://) or a barcode of 8, 12, 13 or 14 digits.",
};

export function refusalFor(reason: string): string {
  return REFUSALS[reason as RefusalReason] ?? REFUSALS.paused;
}

/** An HMAC of the caller's IP: the limits key on it, and the IP itself is never stored. */
export function ipHash(ip: string, key: string): string {
  return createHmac("sha256", key).update(`founding-ip:${ip}`).digest("hex");
}

/**
 * Cloudflare Turnstile: true only when Cloudflare says the token is good. No secret, a
 * network failure or anything unexpected is false, so a run without the challenge is refused.
 */
export async function verifyTurnstile(
  token: unknown,
  secret: string | undefined,
  ip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret || typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return false;
  }
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json()) as { success?: unknown };
    return body.success === true;
  } catch {
    return false;
  }
}

/** A trusted read: a product came back at or above the 0.7 gate. */
export function isTrusted(stamp: { product_returned: boolean | null; confidence: number | null }) {
  return stamp.product_returned === true && (stamp.confidence ?? 0) >= 0.7;
}

/** The curl command with the builder's own input, ready to paste. */
export function curlFor(input: FoundingInput, key: string): string {
  const body = JSON.stringify(input.kind === "url" ? { url: input.value } : { gtin: input.value });
  return `curl -X POST ${API_BASE}/read_product \\
  -H "authorization: Bearer ${key}" \\
  -H "content-type: application/json" \\
  -d '${body.replace(/'/g, "'\\''")}'`;
}

/** An MCP client config pointing at the server with the builder's key. */
export function mcpConfigFor(key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        legibility: { url: MCP_URL, headers: { Authorization: `Bearer ${key}` } },
      },
    },
    null,
    2,
  );
}

/**
 * What a builder may have typed into "what you are building" that must never leave the app:
 * addresses, URLs, IPs and barcodes are replaced before the export carries it.
 */
export function scrubFreeText(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+/g, "[removed]")
    .replace(/\bhttps?:\/\/\S+/gi, "[removed]")
    .replace(/\bwww\.\S+/gi, "[removed]")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[removed]")
    .replace(/\b\d{8,14}\b/g, "[removed]")
    .slice(0, 2000);
}

/**
 * The magic-link request for the email step. Supabase sends its own fixed template; all the
 * app adds is where the link lands (the entry id only) and sign-up metadata (the entry id and
 * the attribution touch). Nothing the visitor typed (input, use case, stores) goes anywhere
 * near the email.
 */
export function verificationOptions(origin: string, entryId: string, touch: Touch | null) {
  return {
    emailRedirectTo: `${origin}/founding-200?entry=${encodeURIComponent(entryId)}`,
    data: { founding_entry: entryId, ...(touch ? { attribution: touch } : {}) },
  };
}

// ---------------------------------------------------------------------------- the words

/** The one offer, worded as the Free plan allows until the 30-day trial (A8) is live. */
export const COPY = {
  title: "The Founding 200",
  lead: "Try Legibility on one of your own products in about two minutes. You do not need an account to run the test.",
  offer:
    "Founding 200 members get a 30-day free trial in exchange for feedback, plus a test report on their own products. The trial runs on the Free plan: up to 1,000 trusted reads a month, and no card.",
  scope:
    "Legibility reads structured product pages (schema.org JSON-LD), Shopify stores and barcodes. Below a 0.7 confidence it returns no product rather than a guess.",
  emailAsk:
    "Want a key and this report? Enter your email and we will send you a sign-in link. That link is the only email we send before you confirm.",
  sent: "Check your inbox for a sign-in link. Open it in any browser and your key and report will be waiting.",
  fitNote:
    "Legibility read this product with confidence, so your key should work well for products like it.",
  nonFitNote:
    "We could not read this product with confidence today. Legibility reads structured pages, Shopify stores and barcodes, so your key will work best on those. You can still use it: a read that returns no product is never charged.",
  callOffer: (contact: string) =>
    `Want a test report on more of your products and a 25-minute call? Email ${contact} and Krish will set it up with you.`,
} as const;

/** Phrases no page or message here may contain (A3 test 7). */
export const FORBIDDEN_COPY: RegExp[] = [
  /calendly/i,
  /cal\.com/i,
  /book a (call|time|slot|meeting|demo)/i,
  /schedule a (call|meeting|demo)/i,
  /\bmainnet\b/i,
  /\bunlimited\b/i,
  /\bwaive/i,
  /\$\s?\d/,
  /\bprice[ds]? (at|from)\b/i,
  /\u2014/,
];

/** What the page shows of a read: the fields a builder checks, never the raw envelope. */
export type FoundingReport = {
  title: string | null;
  brand: string | null;
  price: { low: number | null; high: number | null; currency: string | null } | null;
  availability: string | null;
  confidence: number | null;
  method: string | null;
  cost_usd: number;
  legibility_id: string | null;
};

const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function reportFrom(envelope: unknown): FoundingReport {
  const e = (envelope && typeof envelope === "object" ? envelope : {}) as Record<string, unknown>;
  const p = (e.product && typeof e.product === "object" ? e.product : null) as Record<
    string,
    unknown
  > | null;
  const price = (p?.price && typeof p.price === "object" ? p.price : null) as Record<
    string,
    unknown
  > | null;
  return {
    title: str(p?.title) ?? str(p?.name),
    brand: str(p?.brand),
    price: price
      ? { low: num(price.low), high: num(price.high), currency: str(price.currency) }
      : null,
    availability: str(p?.availability),
    confidence: num(e.confidence),
    method: str(e.method),
    cost_usd: num(e.cost_usd) ?? 0,
    legibility_id: str(e.legibility_id),
  };
}
