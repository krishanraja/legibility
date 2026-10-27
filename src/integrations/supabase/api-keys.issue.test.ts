import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * issueKey: the one way a key is issued (the dashboard and the Founding 200 page). One active
 * key per account, the full key returned once, only the hash stored, the touch attached.
 */

const h = vi.hoisted(() => ({
  existing: [] as { id: string }[],
  insertResult: { data: { id: "key-1" }, error: null } as { data: unknown; error: unknown },
  inserted: [] as Record<string, unknown>[],
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ is: async () => ({ data: h.existing }) }) }),
      insert: (row: Record<string, unknown>) => {
        h.inserted.push(row);
        return { select: () => ({ single: async () => h.insertResult }) };
      },
    }),
    rpc: h.rpc,
  },
}));

const { hashKey, issueKey } = await import("./api-keys.server");

beforeEach(() => {
  h.existing = [];
  h.inserted.length = 0;
  h.insertResult = { data: { id: "key-1" }, error: null };
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});

const COOKIE = `lg_touch=${encodeURIComponent(
  JSON.stringify({
    utm_source: "outreach",
    utm_medium: "introduction",
    invitation_id: "legibility:x",
    touched_at: new Date(Date.now() - 60_000).toISOString(),
  }),
)}`;

describe("issueKey", () => {
  it("issues a key once, storing only its hash, and attaches the session's touch", async () => {
    const issued = await issueKey("user-1", "founding-200", COOKIE);
    expect(issued?.key).toMatch(/^lgk_/);
    expect(issued?.keyId).toBe("key-1");
    expect(h.inserted[0]).toMatchObject({ user_id: "user-1", name: "founding-200" });
    expect(h.inserted[0].key_hash).toBe(hashKey(issued!.key));
    expect(JSON.stringify(h.inserted)).not.toContain(issued!.key);
    const [fn, args] = h.rpc.mock.calls[0];
    expect(fn).toBe("record_key_creation");
    expect(args).toMatchObject({ _key_id: "key-1", _touch: { invitation_id: "legibility:x" } });
  });

  it("passes no touch when the session has none", async () => {
    await issueKey("user-1", "default", null);
    expect(h.rpc.mock.calls[0][1]).toEqual({ _key_id: "key-1", _touch: null });
  });

  it("returns null when the account already has an active key", async () => {
    h.existing = [{ id: "old" }];
    expect(await issueKey("user-1", "default", null)).toBeNull();
    expect(h.inserted).toHaveLength(0);
  });

  it("throws when the key cannot be written", async () => {
    h.insertResult = { data: null, error: { message: "down" } };
    await expect(issueKey("user-1", "default", null)).rejects.toThrow("Could not create key.");
  });

  it("never fails the key on attribution", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await issueKey("user-1", "default", null)).not.toBeNull();
    h.rpc.mockRejectedValueOnce(new Error("down"));
    expect(await issueKey("user-1", "default", null)).not.toBeNull();
  });
});
