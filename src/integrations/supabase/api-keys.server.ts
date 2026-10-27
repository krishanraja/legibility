// Server-only API-key helpers. The .server.ts suffix keeps this out of the client bundle.
// Keys are shown once at creation; only the SHA-256 hash is stored (key_hash is service-role-only).
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// lgk_ + 24 random bytes (base64url). Returned in full ONCE; we persist only the hash.
export function generateKeyMaterial() {
  const secret = randomBytes(24).toString("base64url");
  const key = `lgk_${secret}`;
  return { key, prefix: key.slice(0, 12), last_four: key.slice(-4), key_hash: hashKey(key) };
}

// Validate a presented key: hash -> lookup non-revoked. Returns the principal or null.
//
// A2: `client` is the caller's client name (the REST User-Agent's first product token). On a
// key's first use (last_used_at still null) it is kept as the first client that used the key.
export async function validateApiKey(
  presented: string | null,
  opts: { client?: string | null } = {},
): Promise<{ userId: string; keyId: string } | null> {
  if (!presented || !presented.startsWith("lgk_")) return null;
  const key_hash = hashKey(presented);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at, last_used_at")
    .eq("key_hash", key_hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  // last_used_at is touched alongside the awaited usage write in the caller (serverless
  // freezes the function after the response, so fire-and-forget writes are lost).
  if (opts.client && data.last_used_at == null) await recordKeyClient(data.id, opts.client);
  return { userId: data.user_id, keyId: data.id };
}

// A2: keep the first client that used a key. Once only (the database ignores a second), and
// best-effort: attribution never fails or slows a call by more than one write.
export async function recordKeyClient(keyId: string, client: string | null): Promise<void> {
  if (!client) return;
  try {
    await supabaseAdmin.rpc("record_key_client", { _key_id: keyId, _client: client });
  } catch {
    /* attribution best-effort */
  }
}

export type IssuedKey = { key: string; prefix: string; last_four: string; keyId: string };

/**
 * Issue a key to an account, the one way the dashboard and the Founding 200 page both do it:
 * one active key per account (v1), the full key returned once, only its hash stored, and the
 * session's attribution touch (A2) attached. Returns null when the account already has an
 * active key; throws when the key cannot be written. Attribution is best-effort.
 */
export async function issueKey(
  userId: string,
  name: string,
  cookieHeader: string | null | undefined,
): Promise<IssuedKey | null> {
  const { data: existing } = await supabaseAdmin
    .from("api_keys")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (existing && existing.length >= 1) return null;

  const mat = generateKeyMaterial();
  const { data: created, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      prefix: mat.prefix,
      key_hash: mat.key_hash,
      last_four: mat.last_four,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Could not create key.");

  try {
    const { touchFromCookie } = await import("@/lib/api/attribution");
    const touch = touchFromCookie(cookieHeader, new Date());
    const { error: touchError } = await supabaseAdmin.rpc("record_key_creation", {
      _key_id: created.id,
      _touch: touch,
    });
    if (touchError) console.error("[keys] key touch not recorded", touchError.code);
  } catch {
    /* attribution best-effort */
  }
  return { key: mat.key, prefix: mat.prefix, last_four: mat.last_four, keyId: created.id };
}
