import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { signVerdict, type Verdict } from "@/lib/api/check-signature";

/**
 * Capture is the only write path into the record from the public internet, now that anon's
 * direct INSERT on waitlist is revoked. Two properties carry the weight:
 *
 *  1. A verdict this service did not issue never enters the record. Without that, anyone
 *     could script a fabricated "blocked" against a competitor's domain, which is the same
 *     false accusation classify()'s refusalConfirmed path refuses to make one layer down.
 *
 *  2. A failed send does not cost the capture. The row is written before the email goes out,
 *     so a mail provider having a bad minute loses the send and not the person.
 */

const SECRET = "test-signing-secret";

const h = vi.hoisted(() => ({
  checkRows: [] as Record<string, unknown>[],
  waitlistRows: [] as Record<string, unknown>[],
  captureRows: [] as Record<string, unknown>[],
  checkError: null as { message: string } | null,
  waitlistError: null as { message: string } | null,
  captureError: null as { message: string } | null,
  sent: { sent: true } as { sent: boolean; error?: string },
  sendCalls: [] as unknown[][],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        if (table === "domain_checks") {
          h.checkRows.push(row);
          const result = { data: h.checkError ? null : { id: "check-1" }, error: h.checkError };
          return { select: () => ({ single: () => Promise.resolve(result) }) };
        }
        if (table === "waitlist") {
          h.waitlistRows.push(row);
          return Promise.resolve({ error: h.waitlistError });
        }
        if (table === "check_captures") {
          h.captureRows.push(row);
          return Promise.resolve({ error: h.captureError });
        }
        throw new Error(`unexpected table in capture route: ${table}`);
      },
    }),
  },
}));

vi.mock("@/lib/api/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/email")>();
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => {
      h.sendCalls.push(args);
      return Promise.resolve(h.sent);
    },
  };
});

function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    host: "example.com",
    readable: false,
    reason: "js_shell",
    method: "none",
    detail: "40000B of HTML, only 120B of readable text",
    http_status: 200,
    checked_at: new Date().toISOString(),
    ...over,
  };
}

async function post(body: unknown) {
  const mod = await import("./capture");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.POST({
    request: new Request("https://legibility.io/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

/**
 * A fresh address per request. The limiter is module state shared across the whole file, so
 * without this the twelfth test in the file would be refused for reasons having nothing to
 * do with what it asserts.
 */
let ipCounter = 0;
function randomIp() {
  ipCounter += 1;
  return `10.0.0.${ipCounter % 255}.${ipCounter}`;
}

/** The happy path, signed correctly. */
async function postSigned(over: Partial<Verdict> = {}, email = "buyer@example.com") {
  const v = verdict(over);
  return post({ email, verdict: v, signature: signVerdict(v, SECRET) });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.checkRows.length = 0;
  h.waitlistRows.length = 0;
  h.captureRows.length = 0;
  h.sendCalls.length = 0;
  h.checkError = null;
  h.waitlistError = null;
  h.captureError = null;
  h.sent = { sent: true };
  process.env.CHECK_SIGNING_SECRET = SECRET;
  process.env.RESEND_API_KEY = "re_test";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.CHECK_SIGNING_SECRET;
  delete process.env.RESEND_API_KEY;
  vi.restoreAllMocks();
});

describe("POST /api/capture", () => {
  it("records the check, the person, and sends the read", async () => {
    const res = await postSigned();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, emailed: true });

    expect(h.checkRows).toHaveLength(1);
    expect(h.checkRows[0]).toMatchObject({
      host: "example.com",
      readable: false,
      failure_reason: "js_shell",
      method: "none",
      http_status: 200,
    });
    // The hash is over the same bytes the signature covered, so the stored row identifies
    // exactly what was signed.
    expect(h.checkRows[0].envelope_hash).toMatch(/^[0-9a-f]{64}$/);

    expect(h.waitlistRows).toHaveLength(1);
    expect(h.waitlistRows[0]).toMatchObject({
      email: "buyer@example.com",
      company: "example.com",
      source: "checker",
      check_id: "check-1",
    });
    // The admin's decision on an existing row must survive a re-capture, so status is never
    // part of the upsert payload.
    expect(h.waitlistRows[0]).not.toHaveProperty("status");

    // The person-to-check link, which is what the dashboard reads. waitlist cannot hold it:
    // its email column is UNIQUE, so a second domain would overwrite the first.
    expect(h.captureRows).toEqual([{ email: "buyer@example.com", check_id: "check-1" }]);
  });

  it("reports a failed capture-link write rather than claiming success", async () => {
    h.captureError = { message: "denied" };
    const res = await postSigned();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "storage_failed" });
    expect(h.sendCalls).toHaveLength(0);
  });

  it("does not store a verdict it did not issue", async () => {
    const forged = verdict({ host: "competitor.com", reason: "blocked" });
    const res = await post({
      email: "a@b.com",
      verdict: forged,
      signature: signVerdict(forged, "some-other-secret"),
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "unverified_verdict" });
    expect(h.checkRows).toHaveLength(0);
    expect(h.waitlistRows).toHaveLength(0);
  });

  it("does not store a verdict whose fields were altered after signing", async () => {
    const v = verdict();
    const signature = signVerdict(v, SECRET);
    const res = await post({
      email: "a@b.com",
      verdict: { ...v, reason: "blocked" },
      signature,
    });
    expect(res.status).toBe(400);
    expect(h.checkRows).toHaveLength(0);
  });

  it("fails closed when no signing secret is configured", async () => {
    delete process.env.CHECK_SIGNING_SECRET;
    const v = verdict();
    const res = await post({ email: "a@b.com", verdict: v, signature: signVerdict(v, SECRET) });
    expect(res.status).toBe(400);
    expect(h.checkRows).toHaveLength(0);
  });

  it("refuses an unsigned verdict", async () => {
    const res = await post({ email: "a@b.com", verdict: verdict() });
    expect(res.status).toBe(400);
    expect(h.checkRows).toHaveLength(0);
  });

  it("normalises the email before storing it", async () => {
    await postSigned({}, "  Buyer@Example.COM ");
    expect(h.waitlistRows[0].email).toBe("buyer@example.com");
  });

  it.each([
    ["not an email", "nope"],
    ["no domain dot", "a@b"],
    ["empty", ""],
    ["whitespace inside", "a b@c.com"],
    ["over the RFC length cap", `${"a".repeat(250)}@example.com`],
  ])("refuses an address that is %s", async (_label, email) => {
    const v = verdict();
    const res = await post({ email, verdict: v, signature: signVerdict(v, SECRET) });
    expect(res.status).toBe(422);
    expect(h.checkRows).toHaveLength(0);
  });

  it("refuses a non-string email", async () => {
    const v = verdict();
    const res = await post({ email: 42, verdict: v, signature: signVerdict(v, SECRET) });
    expect(res.status).toBe(422);
  });

  it("refuses a body that is not JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "bad_request" });
  });

  it("refuses an oversized body before parsing it", async () => {
    const res = await post(JSON.stringify({ email: "a@b.com", pad: "x".repeat(9000) }));
    expect(res.status).toBe(413);
  });

  it.each([
    ["missing host", { host: "" }],
    ["non-boolean readable", { readable: "yes" }],
    ["a reason outside the closed set", { reason: "vibes" }],
    ["a non-string reason", { reason: 7 }],
    ["a non-integer http_status", { http_status: 1.5 }],
    ["a non-numeric http_status", { http_status: "200" }],
    ["missing checked_at", { checked_at: undefined }],
    ["a non-string method", { method: 1 }],
    ["a non-string detail", { detail: null }],
  ])("refuses a verdict with %s", async (_label, over) => {
    const v = { ...verdict(), ...over };
    const res = await post({
      email: "a@b.com",
      verdict: v,
      signature: signVerdict(v as Verdict, SECRET),
    });
    expect(res.status).toBe(400);
    expect(h.checkRows).toHaveLength(0);
  });

  it("refuses a readable verdict that also carries a reason", async () => {
    // The same invariant the table's check constraint holds. Enforced here too so it is a
    // 400 about the request rather than a 500 from Postgres.
    const v = { ...verdict(), readable: true, reason: "js_shell" } as Verdict;
    const res = await post({ email: "a@b.com", verdict: v, signature: signVerdict(v, SECRET) });
    expect(res.status).toBe(400);
  });

  it("refuses an unreadable verdict carrying no reason", async () => {
    const v = { ...verdict(), readable: false, reason: null } as Verdict;
    const res = await post({ email: "a@b.com", verdict: v, signature: signVerdict(v, SECRET) });
    expect(res.status).toBe(400);
  });

  it("refuses a verdict that is not an object", async () => {
    for (const bad of [null, "string", 42]) {
      const res = await post({ email: "a@b.com", verdict: bad, signature: "x" });
      expect(res.status).toBe(400);
    }
  });

  it("accepts a readable verdict with a null reason", async () => {
    const res = await postSigned({ readable: true, reason: null, method: "jsonld" });
    expect(res.status).toBe(200);
    expect(h.checkRows[0]).toMatchObject({ readable: true, failure_reason: null });
  });

  it("accepts a verdict with no http_status", async () => {
    const res = await postSigned({ http_status: null });
    expect(res.status).toBe(200);
    expect(h.checkRows[0].http_status).toBeNull();
  });

  it("reports a failed send without losing the capture", async () => {
    h.sent = { sent: false, error: "resend 403" };
    const res = await postSigned();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, emailed: false });
    // The row is what matters and it was written before the send was attempted.
    expect(h.checkRows).toHaveLength(1);
    expect(h.waitlistRows).toHaveLength(1);
  });

  it("succeeds without sending when no mail provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await postSigned();
    await expect(res.json()).resolves.toEqual({ ok: true, emailed: false });
    expect(h.sendCalls).toHaveLength(0);
    expect(h.waitlistRows).toHaveLength(1);
  });

  it("reports a failed check write rather than claiming success", async () => {
    h.checkError = { message: "unique violation" };
    const res = await postSigned();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "storage_failed" });
    // Nothing downstream ran, so no email claims a record that does not exist.
    expect(h.waitlistRows).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(0);
  });

  it("reports a failed waitlist write rather than claiming success", async () => {
    h.waitlistError = { message: "denied" };
    const res = await postSigned();
    expect(res.status).toBe(500);
    expect(h.captureRows).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(0);
  });

  it("refuses once the per-address budget is spent", async () => {
    const mod = await import("./capture");
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
    const handlers = (mod.Route as any).options.server.handlers;
    const ip = "203.0.113.7";
    const call = () => {
      const v = verdict();
      return handlers.POST({
        request: new Request("https://legibility.io/api/capture", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ email: "a@b.com", verdict: v, signature: signVerdict(v, SECRET) }),
        }),
      });
    };
    for (let i = 0; i < 5; i += 1) expect((await call()).status).toBe(200);
    const refused = await call();
    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ error: "rate_limited" });
  });
});
