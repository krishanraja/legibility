import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/docs/api/read-product")({
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">read_product</h1>
      <p className="text-lg text-muted-foreground">
        Resolve one reference (URL or GTIN) into a typed product object.
      </p>
      <h2 className="font-display text-2xl mt-8">Request</h2>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
        {`POST /v1/read_product
{ "url": "https://store.com/p/123" }
// or
{ "gtin": "00194253433767" }`}
      </pre>
      <h2 className="font-display text-2xl mt-8">Response shape (Schema.org Product superset)</h2>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
        {`{
  "@type": "Product",
  "canonical": { "gtin","mpn","brand","model" },
  "title", "description", "category",
  "attributes": { /* normalized */ },
  "images": ["..."],
  "price": { "band": {low,high,currency}, "as_of", "n_sources" },
  "availability", "reviews_summary", "variants": [],
  "source": { "method": "jsonld|opengraph|render|barcode|cache", "urls": [...] },
  "confidence": 0.0-1.0,
  "cost_usd": 0.012
}`}
      </pre>
    </article>
  ),
});
