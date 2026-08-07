import { createFileRoute } from "@tanstack/react-router";
import { getOnly } from "@/lib/api/http";

// Public health probe: worker reachability + which subsystems are configured.
// Used for uptime monitoring and a quick GA-readiness read. No auth, never cached.

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      ...getOnly,
      GET: async () => {
        const checks: Record<string, string> = {};

        let workerOk = false;
        try {
          const u = new URL(process.env.PLINTH_EXTRACTOR_URL ?? "");
          const res = await fetch(`${u.protocol}//${u.host}/health`, {
            signal: AbortSignal.timeout(8000),
          });
          workerOk = res.ok;
        } catch {
          /* worker unreachable */
        }
        checks.worker = workerOk ? "ok" : "down";
        checks.billing = process.env.STRIPE_SECRET_KEY ? "configured" : "off";
        const recipient = process.env.X402_RECIPIENT;
        checks.x402 =
          recipient && recipient !== "0x0000000000000000000000000000000000000000"
            ? "configured"
            : "off";

        const ok = workerOk;
        return new Response(
          JSON.stringify({ status: ok ? "ok" : "degraded", checks, ts: new Date().toISOString() }),
          {
            status: ok ? 200 : 503,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
