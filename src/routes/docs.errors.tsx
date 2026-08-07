import { createFileRoute } from "@tanstack/react-router";
const ROWS: [string, string, string][] = [
  ["400", "invalid_request", "Body missing url, gtin, or query."],
  ["401", "missing_key", "No Authorization header."],
  ["403", "key_revoked", "Key has been revoked or account suspended."],
  ["402", "payment_required", "x402 flow. See MCP docs."],
  ["404", "not_resolvable", "Reference could not be resolved with sufficient confidence."],
  ["422", "low_confidence", "Resolved below 0.7; not cached."],
  ["429", "rate_limited", "Per-key burst or sustained rate exceeded."],
  ["451", "takedown", "URL is under a takedown."],
  ["500", "internal_error", "Something on our side. Includes request_id."],
];
export const Route = createFileRoute("/docs/errors")({
  component: () => (
    <article>
      <h1 className="font-display text-5xl">Errors</h1>
      <p className="mt-3 text-muted-foreground">
        All errors return JSON with <span className="font-mono">code</span>,{" "}
        <span className="font-mono">message</span>, and{" "}
        <span className="font-mono">request_id</span>.
      </p>
      <table className="mt-8 w-full text-sm border border-hairline rounded-md overflow-hidden">
        <thead className="bg-surface font-mono text-xs uppercase tracking-widest text-muted-foreground text-left">
          <tr>
            <th className="px-4 py-3">HTTP</th>
            <th className="px-4 py-3">code</th>
            <th className="px-4 py-3">meaning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {ROWS.map(([h, c, m]) => (
            <tr key={c}>
              <td className="px-4 py-3 font-mono text-signal">{h}</td>
              <td className="px-4 py-3 font-mono">{c}</td>
              <td className="px-4 py-3 text-muted-foreground">{m}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  ),
});
