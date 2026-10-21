import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/seo";
import {
  NO_SUBSCRIPTION_PER_MINUTE,
  RATE_LIMITS,
  RATE_WINDOW_SECONDS,
} from "@/content/api-reference";

const PRE = "rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto";

export const Route = createFileRoute("/docs/rate-limits")({
  head: () => ({
    meta: pageMeta({
      title: "Rate limits · Legibility docs",
      description:
        "Per-minute rate limits for each Legibility plan, the response headers that report them, what a 429 means, and why x402 calls are not rate limited.",
      path: "/docs/rate-limits",
    }),
  }),
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">Rate limits</h1>
      <p className="text-lg text-muted-foreground">
        Keyed calls are limited per account over a sliding {RATE_WINDOW_SECONDS}-second window.
        Every metered call counts once, whether it was a cache hit, a live extraction or a miss.
        There is no daily cap and no concurrency cap; the monthly allowance of trusted reads is
        separate and enforced as a <span className="font-mono">402</span>.
      </p>

      <table className="w-full text-sm border border-hairline rounded-md overflow-hidden">
        <thead className="bg-surface font-mono text-xs uppercase tracking-widest text-muted-foreground text-left">
          <tr>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Calls per minute</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline font-mono text-xs">
          {RATE_LIMITS.map((r) => (
            <tr key={r.planId}>
              <td className="px-4 py-3 text-foreground">{r.plan}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.perMinute.toLocaleString("en-GB")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground">
        An account without an active subscription gets {NO_SUBSCRIPTION_PER_MINUTE} calls per
        minute. <span className="font-mono">report_outcome</span> is not rate limited.
      </p>

      <h2 className="font-display text-2xl mt-8">Response headers</h2>
      <p className="text-muted-foreground">
        Every keyed response from <span className="font-mono">read_product</span>,{" "}
        <span className="font-mono">resolve_product</span>,{" "}
        <span className="font-mono">compare_products</span> and{" "}
        <span className="font-mono">brief_product</span> carries:
      </p>
      <pre className={PRE}>
        {`x-ratelimit-limit:     600
x-ratelimit-remaining: 587
x-ratelimit-reset:     ${RATE_WINDOW_SECONDS}`}
      </pre>
      <p className="text-muted-foreground">
        <span className="font-mono">x-ratelimit-reset</span> is in seconds, not a timestamp, and is
        the window length.
      </p>

      <h2 className="font-display text-2xl mt-8">429 response</h2>
      <pre className={PRE}>
        {`HTTP/1.1 429
retry-after: ${RATE_WINDOW_SECONDS}

{ "error": "rate_limited", "message": "Rate limit exceeded." }`}
      </pre>
      <p className="text-muted-foreground">
        Wait <span className="font-mono">retry-after</span> seconds before retrying. On MCP, a keyed{" "}
        <span className="font-mono">tools/call</span> over the limit returns HTTP{" "}
        <span className="font-mono">429</span> with JSON-RPC error{" "}
        <span className="font-mono">-32099</span> and the same headers.
      </p>

      <h2 className="font-display text-2xl mt-8">x402 calls</h2>
      <p className="text-muted-foreground">
        MCP calls paid per call with x402 are not rate limited and do not use an account&apos;s
        quota: each one is paid on-chain before it runs.
      </p>
    </article>
  ),
});
