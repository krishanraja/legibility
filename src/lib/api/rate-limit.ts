// Per-IP rate limiting for the unauthenticated public endpoints.
//
// Lifted out of src/routes/api/check.ts so /api/check and /api/capture share one
// implementation rather than each growing their own. Two copies of a limiter drift, and the
// one that drifts is always the one nobody tested.
//
// Deliberately not a fifth piece of infrastructure. It counts per serverless instance, so it
// is a floor rather than a guarantee: it stops one browser hammering an endpoint, which is
// the realistic abuse. A determined distributed caller is bounded instead by the timeouts and
// byte caps at the call sites, which is why those exist rather than being left to defaults.
//
// Authenticated API traffic is limited elsewhere and properly, against the database, in
// src/integrations/supabase/rate-limit.server.ts. This is only for the front door.

export type Limiter = {
  /** True when this call should be refused. Records the attempt either way. */
  limited(key: string, now?: number): boolean;
};

/**
 * A fixed-window counter over the last `windowMs`.
 *
 * `maxKeys` bounds memory on a long-lived instance. Without it the map grows for every
 * distinct address that ever called, which on a warm instance is a slow leak rather than an
 * attack: the sweep below runs only when the map is already oversized, so the common path
 * stays one map read and one write.
 */
export function createLimiter(max: number, windowMs: number, maxKeys = 5000): Limiter {
  const hits = new Map<string, number[]>();

  return {
    limited(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);

      if (hits.size > maxKeys) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }

      return recent.length > max;
    },
  };
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * x-forwarded-for is a client-settable header that the platform appends to, so the leftmost
 * entry is the one Vercel saw and everything after it is whatever the client claimed. Taking
 * the first entry is the convention; it is also spoofable, which is why this bounds abuse
 * rather than preventing it, and why nothing security-relevant is keyed on it.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
