import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A4 route: auth, window checks, size limits and response headers. The database is mocked;
 * the rows themselves are tested against a real Postgres in src/test/db/growth-export.test.ts.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  maxBytes: 20 * 1024 * 1024,
}));

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: h.rpc } }));
vi.mock("@/lib/api/growth-export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/growth-export")>();
  return {
    ...actual,
    get MAX_BYTES() {
      return h.maxBytes;
    },
  };
});

// Synthetic only.
const TOKEN = "synthetic-export-token";
const AUTH = { authorization: `Bearer ${TOKEN}` };
const WINDOW = "start=2026-10-01T00:00:00Z&end=2026-10-02T00:00:00Z";
const ROWS = { accounts: [], reads: [], events: [] };

async function call(query: string, headers: Record<string, string> = {}, method = "GET") {
  const mod = await import("./export");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  const request = new Request(`https://legibility.io/api/internal/growth/export?${query}`, {
    method,
    headers,
  });
  return handlers[method]({ request }) as Promise<Response>;
}

function db(counts: Record<string, number> = { accounts: 0, reads: 0, events: 0 }, rows = ROWS) {
  h.rpc.mockImplementation(async (fn: string) =>
    fn === "growth_export_counts" ? { data: [counts], error: null } : { data: rows, error: null },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.maxBytes = 20 * 1024 * 1024;
  process.env.GROWTH_EXPORT_TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
  process.env.EXPORT_ID_KEY = "x".repeat(40);
  db();
});

afterEach(() => {
  delete process.env.GROWTH_EXPORT_TOKEN_SHA256;
  delete process.env.EXPORT_ID_KEY;
});

describe("GET /api/internal/growth/export", () => {
  it("answers 200 directly, as JSON, never cached", async () => {
    const res = await call(WINDOW, AUTH);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("location")).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ export_version: "1.0.0", mode: "live", app_revision: "unknown" });
    expect(h.rpc).toHaveBeenCalledWith("growth_export_counts", {
      _start: "2026-10-01T00:00:00.000Z",
      _end: "2026-10-02T00:00:00.000Z",
      _captured_at: body.captured_at,
    });
  });

  it("5. 401 with no detail for a missing or wrong token, or when no token is configured", async () => {
    for (const headers of [{}, { authorization: "Bearer wrong" }] as Record<string, string>[]) {
      const res = await call(WINDOW, headers);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    delete process.env.GROWTH_EXPORT_TOKEN_SHA256;
    expect((await call(WINDOW, AUTH)).status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("503 when the id key is missing or too short, before reading anything", async () => {
    process.env.EXPORT_ID_KEY = "short";
    expect((await call(WINDOW, AUTH)).status).toBe(503);
    delete process.env.EXPORT_ID_KEY;
    expect((await call(WINDOW, AUTH)).status).toBe(503);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("5. 400 for a reversed, future or over-92-day window", async () => {
    for (const q of [
      "start=2026-10-02T00:00:00Z&end=2026-10-01T00:00:00Z",
      "start=2026-10-01T00:00:00Z&end=2999-01-01T00:00:00Z",
      "start=2026-01-01T00:00:00Z&end=2026-10-01T00:00:00Z",
      "fields=emails",
    ]) {
      const res = await call(q, AUTH);
      expect(res.status, q).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("5. 413 when a section is over 100,000 rows, before reading the rows", async () => {
    db({ accounts: 0, reads: 100_001, events: 0 });
    const res = await call(WINDOW, AUTH);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "window_too_large" });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("5. 413 when the body would be over the byte limit", async () => {
    h.maxBytes = 10;
    expect((await call(WINDOW, AUTH)).status).toBe(413);
  });

  it("503 when the database cannot answer", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await call(WINDOW, AUTH)).status).toBe(503);
    h.rpc
      .mockResolvedValueOnce({ data: [{ accounts: 0, reads: 0, events: 0 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await call(WINDOW, AUTH)).status).toBe(503);
  });

  it("5. never answers with a redirect, and refuses other methods", async () => {
    const statuses = await Promise.all([
      call(WINDOW, AUTH).then((r) => r.status),
      call(WINDOW).then((r) => r.status),
      call("", AUTH).then((r) => r.status),
    ]);
    expect(statuses.every((s) => s < 300 || s >= 400)).toBe(true);
    expect((await call(WINDOW, AUTH, "POST")).status).toBe(405);
  });
});
