import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/docs/")({
  component: () => (
    <article>
      <h1 className="font-display text-5xl">Legibility docs</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Legibility is a product-data primitive for agents. One call → a typed, sourced,
        confidence-scored, cost-stamped product object.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          [
            "Quickstart",
            "/docs/quickstart",
            "Get a key and make your first call in under a minute.",
          ],
          ["read_product", "/docs/api/read-product", "URL or GTIN → product object."],
          ["resolve_product", "/docs/api/resolve-product", "Fuzzy string → canonical identifiers."],
          ["MCP + x402", "/docs/mcp", "Connect an agent. Pay per call in USDC."],
        ].map(([t, h, d]) => (
          <a
            key={t}
            href={h}
            className="block rounded-md border border-hairline bg-surface p-5 hover:border-signal"
          >
            <div className="font-display text-2xl text-foreground">{t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{d}</div>
          </a>
        ))}
      </div>
    </article>
  ),
});
