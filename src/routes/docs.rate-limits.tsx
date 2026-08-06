import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/rate-limits")({
  head: () => ({ meta: [{ title: "Rate limits · Legibility docs" }] }),
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">Rate limits</h1>
      <p className="text-lg text-muted-foreground">
        Limits are enforced per API key, per minute and per day. Cached reads count at
        one-tenth the weight of a live extraction.
      </p>

      <table className="w-full text-sm border border-hairline rounded-md overflow-hidden">
        <thead className="bg-surface font-mono text-xs uppercase tracking-widest text-muted-foreground text-left">
          <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Per minute</th><th className="px-4 py-3">Per day</th><th className="px-4 py-3">Concurrent</th></tr>
        </thead>
        <tbody className="divide-y divide-hairline font-mono text-xs">
          {[
            ["Free",    "30",  "1,000",   "4"],
            ["Starter", "120", "10,000",  "16"],
            ["Growth",  "600", "100,000", "64"],
          ].map((row) => (
            <tr key={row[0]}>{row.map((c, i) => <td key={i} className={i === 0 ? "px-4 py-3 text-foreground" : "px-4 py-3 text-muted-foreground"}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-display text-2xl mt-8">Response headers</h2>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
{`x-ratelimit-limit:     120
x-ratelimit-remaining: 87
x-ratelimit-reset:     1734457200`}
      </pre>

      <h2 className="font-display text-2xl mt-8">429 response</h2>
      <p className="text-muted-foreground">
        Over-limit calls return <span className="font-mono">429</span> with
        <span className="font-mono"> retry-after</span> in seconds. The MCP surface returns the
        same status. x402-paid calls share the per-recipient bucket and are subject to the
        same caps to keep cache hit rates honest.
      </p>
    </article>
  ),
});
