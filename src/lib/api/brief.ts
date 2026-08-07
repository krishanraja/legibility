// Deterministic brief composition for brief_product. Extracted from the route so it can be
// tested directly: it is a pure function with a lot of branches, and it is the one place in
// the product where prose is generated for an agent to read.
//
// Deliberately not an LLM. The brief restates typed fields and nothing else, so it can never
// assert something the extraction did not actually find.

export type BriefProduct = {
  title?: string;
  brand?: string | null;
  price?: { low: number; high: number; currency: string; n_sources: number } | null;
  availability?: string;
  attributes?: Record<string, string | number | boolean>;
};

export type BriefEnvelope = {
  product?: BriefProduct | null;
  confidence?: number;
  method?: string;
  cost_usd?: number;
  cached?: boolean;
};

/** Maximum attributes quoted in a brief, so it stays readable at a glance. */
export const MAX_BRIEF_ATTRIBUTES = 5;

export function composeBrief(e: BriefEnvelope): string {
  const p = e.product;
  if (!p) return "No confident product data was found for this query.";

  const parts: string[] = [];
  parts.push(`${p.title}${p.brand ? ` by ${p.brand}` : ""}.`);

  if (p.price) {
    const range =
      p.price.low === p.price.high ? `${p.price.low}` : `${p.price.low} to ${p.price.high}`;
    parts.push(
      `Price ${range} ${p.price.currency} (${p.price.n_sources} source${p.price.n_sources === 1 ? "" : "s"}).`,
    );
  } else {
    // Saying so explicitly matters: silence would read as "free" or "unknown price".
    parts.push("No defensible price band.");
  }

  if (p.availability && p.availability !== "unknown")
    parts.push(`Availability: ${p.availability.replace(/_/g, " ")}.`);

  const attrs = p.attributes ? Object.entries(p.attributes).slice(0, MAX_BRIEF_ATTRIBUTES) : [];
  if (attrs.length)
    parts.push(`Key attributes: ${attrs.map(([k, v]) => `${k}: ${v}`).join("; ")}.`);

  // Always last, always present: an agent reading this must never have to guess how much
  // to trust it, or which method produced it.
  parts.push(`Overall confidence ${e.confidence ?? 0} (source: ${e.method ?? "unknown"}).`);

  return parts.join(" ");
}
