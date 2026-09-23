import { createFileRoute } from "@tanstack/react-router";

/**
 * The docs landing page.
 *
 * It opened "Legibility is a product-data primitive for agents", which is the old
 * positioning, on the page a crawler reaches at sitemap priority 0.9. llms.txt names the
 * primary audience as commercial owners of a catalogue and developers as secondary, so this
 * page now says which audience it is for rather than speaking as though it were the only one.
 */

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Docs · Legibility" },
      {
        name: "description",
        content:
          "The reading engine behind the machine-readability index, as a REST API and an MCP server. Typed objects, calibrated confidence, and the cost of the call in every response.",
      },
    ],
  }),
  component: () => (
    <article>
      <h1 className="font-display text-5xl">Legibility docs</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        These pages document the reading engine as an API. It is the instrument behind the
        machine-readability index rather than the headline, and it is aimed at developers building
        on it. If you came to find out whether an assistant can read your own site, the free check
        on the front page answers that without an account.
      </p>
      <p className="mt-4 text-muted-foreground">
        One call turns a product URL, a barcode, or a fuzzy name into a typed object carrying
        per-field confidence, a price as a band, the method that produced it, and what the call
        cost. A read below the 0.7 trust gate returns nothing and is not billed.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          [
            "Quickstart",
            "/docs/quickstart",
            "Get a key and make your first call in under a minute.",
          ],
          ["read_product", "/docs/api/read-product", "URL or GTIN to a product object."],
          [
            "resolve_product",
            "/docs/api/resolve-product",
            "Fuzzy string to canonical identifiers.",
          ],
          ["MCP and x402", "/docs/mcp", "Connect an agent. Pay per call in USDC."],
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
