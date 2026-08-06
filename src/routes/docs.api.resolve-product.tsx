import { createFileRoute } from "@tanstack/react-router";
import { API_BASE } from "@/config/product";

// P3.7: the old docs described an async API (res_ id + GET /v1/resolutions/{id}) that
// was never built. The real endpoint is SYNCHRONOUS and takes `name`.
export const Route = createFileRoute("/docs/api/resolve-product")({
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">resolve_product</h1>
      <p className="text-lg text-muted-foreground">
        A fuzzy product name to a typed product object, synchronously. Legibility searches, picks
        the best matching product page, extracts it, and returns the same envelope as read_product.
      </p>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
        {`POST ${API_BASE}/resolve_product
{ "name": "sony wh-1000xm5 wireless headphones" }

→ {
  "product": { "title": "...", "brand": "Sony", "price": { ... } },
  "confidence": 0.74,
  "method": "jsonld",
  "cost_usd": 0.012
}`}
      </pre>
      <p className="text-muted-foreground">
        <span className="font-mono">product</span> is null when nothing clears the confidence gate.
        Pass <span className="font-mono">min_confidence</span> to see lower-confidence candidates.
      </p>
    </article>
  ),
});
