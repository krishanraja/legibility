import { describe, expect, it } from "vitest";
import { composeBrief, MAX_BRIEF_ATTRIBUTES, type BriefEnvelope } from "./brief";

/**
 * The brief is the only prose this product generates for an agent to read, and it is
 * deliberately not an LLM. So the thing worth testing is honesty: it must never imply
 * something the extraction did not find, and it must always carry its own confidence.
 */

const FULL: BriefEnvelope = {
  product: {
    title: "Wool Runner",
    brand: "Allbirds",
    price: { low: 98, high: 120, currency: "USD", n_sources: 3 },
    availability: "in_stock",
    attributes: { colour: "Natural Grey", size: "10" },
  },
  confidence: 0.91,
  method: "shopify",
};

describe("composeBrief: the null case", () => {
  it("says plainly that nothing was found", () => {
    expect(composeBrief({ product: null })).toBe(
      "No confident product data was found for this query.",
    );
  });

  it("treats a missing product the same as an explicit null", () => {
    expect(composeBrief({})).toBe("No confident product data was found for this query.");
  });

  it("does not append a confidence sentence to a null brief", () => {
    // A confidence figure next to "nothing found" would be actively misleading.
    expect(composeBrief({ product: null, confidence: 0.9 })).not.toContain("confidence");
  });
});

describe("composeBrief: title and brand", () => {
  it("includes the brand when present", () => {
    expect(composeBrief(FULL)).toContain("Wool Runner by Allbirds.");
  });

  it("omits the brand cleanly when null, with no dangling 'by'", () => {
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, brand: null } });
    expect(s).toContain("Wool Runner.");
    expect(s).not.toContain(" by ");
  });

  it("omits the brand when it is an empty string", () => {
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, brand: "" } });
    expect(s).not.toContain(" by ");
  });
});

describe("composeBrief: price honesty", () => {
  it("renders a band as a range", () => {
    expect(composeBrief(FULL)).toContain("Price 98 to 120 USD (3 sources).");
  });

  it("collapses a band to one figure when low equals high", () => {
    const s = composeBrief({
      ...FULL,
      product: { ...FULL.product!, price: { low: 98, high: 98, currency: "USD", n_sources: 2 } },
    });
    expect(s).toContain("Price 98 USD (2 sources).");
    expect(s).not.toContain("98 to 98");
  });

  it("singularises a single source", () => {
    const s = composeBrief({
      ...FULL,
      product: { ...FULL.product!, price: { low: 98, high: 98, currency: "USD", n_sources: 1 } },
    });
    expect(s).toContain("(1 source).");
  });

  it("states the absence of a price rather than staying silent", () => {
    // Silence would read as free, or as unknown. Neither is what was measured.
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, price: null } });
    expect(s).toContain("No defensible price band.");
  });

  it("does not invent a currency when there is no price", () => {
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, price: null } });
    expect(s).not.toContain("USD");
  });
});

describe("composeBrief: availability", () => {
  it("humanises underscores", () => {
    expect(composeBrief(FULL)).toContain("Availability: in stock.");
  });

  it("omits availability entirely when it is unknown", () => {
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, availability: "unknown" } });
    expect(s).not.toContain("Availability");
  });

  it("omits availability when absent", () => {
    const p = { ...FULL.product! };
    delete p.availability;
    expect(composeBrief({ ...FULL, product: p })).not.toContain("Availability");
  });
});

describe("composeBrief: attributes", () => {
  it("lists attributes as key: value pairs", () => {
    expect(composeBrief(FULL)).toContain("Key attributes: colour: Natural Grey; size: 10.");
  });

  it("caps the list so the brief stays readable", () => {
    const attributes = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, `v${i}`]));
    const s = composeBrief({ ...FULL, product: { ...FULL.product!, attributes } });
    expect(s).toContain("k0: v0");
    expect(s).toContain(`k${MAX_BRIEF_ATTRIBUTES - 1}`);
    expect(s).not.toContain(`k${MAX_BRIEF_ATTRIBUTES}: `);
  });

  it("omits the attributes sentence when there are none", () => {
    expect(composeBrief({ ...FULL, product: { ...FULL.product!, attributes: {} } })).not.toContain(
      "Key attributes",
    );
  });
});

describe("composeBrief: confidence is always disclosed", () => {
  it("ends with confidence and method", () => {
    expect(composeBrief(FULL).endsWith("Overall confidence 0.91 (source: shopify).")).toBe(true);
  });

  it("reports 0 rather than omitting when confidence is missing", () => {
    // An agent must never have to infer trust from silence.
    const e = { ...FULL };
    delete e.confidence;
    expect(composeBrief(e)).toContain("Overall confidence 0 ");
  });

  it("says unknown rather than omitting when the method is missing", () => {
    const e = { ...FULL };
    delete e.method;
    expect(composeBrief(e)).toContain("(source: unknown).");
  });

  it("discloses confidence even for a low-confidence read", () => {
    expect(composeBrief({ ...FULL, confidence: 0.11 })).toContain("Overall confidence 0.11");
  });
});

describe("composeBrief: determinism", () => {
  it("returns the identical string for identical input", () => {
    expect(composeBrief(FULL)).toBe(composeBrief(FULL));
  });

  it("never emits an em dash, which is a house style rule for generated copy", () => {
    const s = composeBrief(FULL);
    expect(s).not.toContain(String.fromCharCode(8212));
  });
});
