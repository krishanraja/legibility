import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The auth path. validateApiKey decides who gets in, so the cases that matter are the
 * rejections: wrong prefix, revoked, unknown, and a database error (which must fail
 * closed rather than admitting the caller).
 *
 * The supabase client is mocked at the module boundary so no network or credentials are
 * needed. The chain is .from().select().eq().is().maybeSingle().
 */

const maybeSingle = vi.fn();
const isFn = vi.fn(() => ({ maybeSingle }));
const eq = vi.fn(() => ({ is: isFn }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from },
}));

const { generateKeyMaterial, hashKey, validateApiKey } = await import("./api-keys.server");

beforeEach(() => vi.clearAllMocks());

describe("hashKey", () => {
  it("is sha256 hex, so 64 characters", () => {
    expect(hashKey("lgk_abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashKey("lgk_abc")).toBe(hashKey("lgk_abc"));
  });

  it("differs for keys that differ by one character", () => {
    expect(hashKey("lgk_abc")).not.toBe(hashKey("lgk_abd"));
  });

  it("matches the published sha256 of the empty string", () => {
    // Pins the algorithm to sha256. If it is ever swapped, this fails immediately, and
    // every stored key_hash in the database would silently stop matching.
    expect(hashKey("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("generateKeyMaterial", () => {
  it("mints a key with the lgk_ prefix", () => {
    expect(generateKeyMaterial().key.startsWith("lgk_")).toBe(true);
  });

  it("derives prefix and last_four from the key itself", () => {
    const m = generateKeyMaterial();
    expect(m.prefix).toBe(m.key.slice(0, 12));
    expect(m.last_four).toBe(m.key.slice(-4));
    expect(m.prefix).toHaveLength(12);
    expect(m.last_four).toHaveLength(4);
  });

  it("stores the hash of the key, never the key", () => {
    const m = generateKeyMaterial();
    expect(m.key_hash).toBe(hashKey(m.key));
    expect(m.key_hash).not.toContain(m.key);
  });

  it("is unique across calls", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateKeyMaterial().key));
    expect(keys.size).toBe(50);
  });
});

describe("validateApiKey", () => {
  it("rejects null without touching the database", async () => {
    expect(await validateApiKey(null)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an empty string without touching the database", async () => {
    expect(await validateApiKey("")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects the old plk_ prefix, which the rebrand retired", async () => {
    expect(await validateApiKey("plk_still_using_the_old_prefix")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a bearer token that is not a Legibility key", async () => {
    expect(await validateApiKey("sk_live_something")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("looks the key up by hash, never by the key itself", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "k1", user_id: "u1" }, error: null });
    await validateApiKey("lgk_secret");
    expect(from).toHaveBeenCalledWith("api_keys");
    expect(eq).toHaveBeenCalledWith("key_hash", hashKey("lgk_secret"));
    // The plaintext key must never appear in a query argument.
    expect(JSON.stringify(eq.mock.calls)).not.toContain("lgk_secret");
  });

  it("filters out revoked keys in the query", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "k1", user_id: "u1" }, error: null });
    await validateApiKey("lgk_secret");
    expect(isFn).toHaveBeenCalledWith("revoked_at", null);
  });

  it("returns the principal for a valid key", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "key-1", user_id: "user-1" }, error: null });
    expect(await validateApiKey("lgk_valid")).toEqual({ userId: "user-1", keyId: "key-1" });
  });

  it("returns null when no row matches", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await validateApiKey("lgk_unknown")).toBeNull();
  });

  it("fails closed on a database error rather than admitting the caller", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "connection lost" } });
    expect(await validateApiKey("lgk_valid")).toBeNull();
  });

  it("fails closed even when an error arrives alongside data", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "k", user_id: "u" },
      error: { message: "partial failure" },
    });
    expect(await validateApiKey("lgk_valid")).toBeNull();
  });
});
