import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/seo";
import { MCP_ERRORS, REST_ERRORS } from "@/content/api-reference";

const TH = "px-4 py-3";
const TABLE = "mt-4 w-full text-sm border border-hairline rounded-md overflow-hidden";
const THEAD =
  "bg-surface font-mono text-xs uppercase tracking-widest text-muted-foreground text-left";

export const Route = createFileRoute("/docs/errors")({
  head: () => ({
    meta: pageMeta({
      title: "Errors · Legibility",
      description:
        "Every error the Legibility REST API and MCP server return, what causes each one, and why a read below the 0.7 trust gate is a 200 with product null rather than an error.",
      path: "/docs/errors",
    }),
  }),
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">Errors</h1>
      <p className="text-lg text-muted-foreground">
        REST errors return JSON with a stable <span className="font-mono">error</span> code and, on
        most responses, a human-readable <span className="font-mono">message</span>. Branch on{" "}
        <span className="font-mono">error</span>, never on the message. New codes are additive.
      </p>

      <h2 className="font-display text-2xl mt-8">A miss is not an error</h2>
      <p className="text-muted-foreground">
        When a page cannot be read at or above the 0.7 trust gate, the call returns{" "}
        <span className="font-mono">200</span> with <span className="font-mono">product: null</span>{" "}
        and the below-gate <span className="font-mono">confidence</span>. On an API key, a miss is
        never billed and never uses quota. An x402 call settles its payment before the read runs, so
        it is paid whatever the read returns.
      </p>

      <h2 className="font-display text-2xl mt-8">REST</h2>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>HTTP</th>
            <th className={TH}>error</th>
            <th className={TH}>when</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {REST_ERRORS.map((r) => (
            <tr key={r.error}>
              <td className="px-4 py-3 font-mono text-signal">{r.status}</td>
              <td className="px-4 py-3 font-mono">{r.error}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground">
        A <span className="font-mono">402</span> for quota also carries{" "}
        <span className="font-mono">plan</span>, <span className="font-mono">used</span>,{" "}
        <span className="font-mono">included</span> and{" "}
        <span className="font-mono">upgrade_url</span>. A <span className="font-mono">429</span>{" "}
        carries <span className="font-mono">retry-after</span>; see{" "}
        <a href="/docs/rate-limits" className="underline">
          rate limits
        </a>
        .
      </p>

      <h2 className="font-display text-2xl mt-8">MCP</h2>
      <p className="text-muted-foreground">
        <span className="font-mono">POST /api/mcp</span> speaks JSON-RPC 2.0. A{" "}
        <span className="font-mono">tools/call</span> with no API key and no payment returns HTTP{" "}
        <span className="font-mono">402</span> with an x402 body,{" "}
        <span className="font-mono">{"{ x402Version, error, accepts }"}</span>, and the same again
        with <span className="font-mono">settle_error</span> when a payment fails to settle. Bad
        tool arguments come back as a normal result with{" "}
        <span className="font-mono">isError: true</span>. Everything else is a JSON-RPC error:
      </p>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>HTTP</th>
            <th className={TH}>code</th>
            <th className={TH}>when</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {MCP_ERRORS.map((r) => (
            <tr key={r.code}>
              <td className="px-4 py-3 font-mono text-signal">{r.status}</td>
              <td className="px-4 py-3 font-mono">{r.code}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  ),
});
