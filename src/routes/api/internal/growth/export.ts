import { createFileRoute } from "@tanstack/react-router";
import { getOnly } from "@/lib/api/http";

// A4: GET /api/internal/growth/export?start=<UTC instant>&end=<UTC instant>[&fields=attribution]
//
// The row-level export the growth engine (growth-legibility) composes into its snapshot.
// Bearer token, held here only as its SHA-256 (GROWTH_EXPORT_TOKEN_SHA256). Opaque ids under
// EXPORT_ID_KEY. Answers directly (never a redirect), no-store, JSON. The rules and the shape
// live in src/lib/api/growth-export.ts.

function json(body: unknown, status: number) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/internal/growth/export")({
  server: {
    handlers: {
      ...getOnly,
      GET: async ({ request }) => {
        const exp = await import("@/lib/api/growth-export");
        if (
          !exp.tokenMatches(
            request.headers.get("authorization"),
            process.env.GROWTH_EXPORT_TOKEN_SHA256,
          )
        ) {
          return json({ error: "unauthorized" }, 401);
        }
        const idKey = process.env.EXPORT_ID_KEY;
        if (!idKey || idKey.length < exp.MIN_ID_KEY_LENGTH) {
          return json({ error: "export_not_configured" }, 503);
        }

        const now = new Date();
        const w = exp.parseWindow(new URL(request.url).searchParams, now);
        if (!w.ok) return json({ error: w.error, message: w.message }, 400);
        const capturedAt = now;
        const range = {
          _start: w.start.toISOString(),
          _end: w.end.toISOString(),
          _captured_at: capturedAt.toISOString(),
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const counted = await supabaseAdmin.rpc("growth_export_counts", range);
        const c = counted.data?.[0];
        if (counted.error || !c) return json({ error: "export_unavailable" }, 503);
        const counts = {
          accounts: Number(c.accounts),
          reads: Number(c.reads),
          events: Number(c.events),
          settlements: Number(c.settlements ?? 0),
        };
        if (exp.tooManyRows(counts)) return json({ error: "window_too_large" }, 413);

        const [read, paid] = await Promise.all([
          supabaseAdmin.rpc("growth_export_rows", range),
          supabaseAdmin.rpc("growth_export_settlements", {
            _start: range._start,
            _end: range._end,
          }),
        ]);
        if (read.error || !read.data || paid.error || !paid.data) {
          return json({ error: "export_unavailable" }, 503);
        }
        const rows = {
          ...(read.data as unknown as import("@/lib/api/growth-export").RawRows),
          settlements: paid.data as unknown as import("@/lib/api/growth-export").RawSettlement[],
        };

        const body = JSON.stringify(
          exp.buildExport({
            rows,
            counts,
            start: w.start,
            end: w.end,
            capturedAt,
            appRevision: exp.appRevision(process.env),
            idKey,
            fields: w.fields,
            settlementsSince: c.settlements_since ? new Date(c.settlements_since) : null,
          }),
        );
        if (Buffer.byteLength(body) > exp.MAX_BYTES) {
          return json({ error: "window_too_large" }, 413);
        }
        return json(body, 200);
      },
    },
  },
});
