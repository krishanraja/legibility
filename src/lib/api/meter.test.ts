import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { stampFromResponse } from "./meter";

/** Build a worker envelope with sensible defaults. */
function envelope(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    request_id: "req_abc",
    product: { name: "Wool Runner" },
    confidence: 0.91,
    calibration_version: "iso-63-2026-07-05",
    cost_usd: 0.004,
    cached: false,
    ...over,
  });
}

const URL_INPUT = { url: "https://www.allbirds.com/products/mens-wool-runner-go" };

describe("stampFromResponse: the billing gate", () => {
  it("bills a trusted read above the gate", () => {
    const s = stampFromResponse(envelope({ confidence: 0.91 }), URL_INPUT);
    expect(s.billable).toBe(true);
    expect(s.product_returned).toBe(true);
  });

  it("bills a read sitting exactly on the 0.7 gate", () => {
    // The gate is documented as "at or above 0.7". This asserts the boundary is inclusive.
    expect(stampFromResponse(envelope({ confidence: 0.7 }), URL_INPUT).billable).toBe(true);
  });

  it("does not bill a read just below the gate", () => {
    expect(stampFromResponse(envelope({ confidence: 0.6999 }), URL_INPUT).billable).toBe(false);
  });

  it("does not bill when the product is null even at high confidence", () => {
    const s = stampFromResponse(envelope({ product: null, confidence: 0.99 }), URL_INPUT);
    expect(s.billable).toBe(false);
    expect(s.product_returned).toBe(false);
  });

  it("does not bill when confidence is absent", () => {
    const s = stampFromResponse(envelope({ confidence: undefined }), URL_INPUT);
    expect(s.confidence).toBeNull();
    expect(s.billable).toBe(false);
  });

  it("does not bill when confidence is not a number", () => {
    const s = stampFromResponse(envelope({ confidence: "0.9" }), URL_INPUT);
    expect(s.confidence).toBeNull();
    expect(s.billable).toBe(false);
  });
});

describe("stampFromResponse: non-JSON and upstream failures", () => {
  it("still produces a durable stamp for a non-JSON upstream body", () => {
    // This is the path that runs on a 502 from the worker. It must not throw, and it must
    // still yield a row, because a failed read is an observation we keep.
    const s = stampFromResponse("<html>502 Bad Gateway</html>", URL_INPUT);
    expect(s.confidence).toBeNull();
    expect(s.product_returned).toBeNull();
    expect(s.billable).toBe(false);
    expect(s.cost_usd).toBe(0);
    expect(s.envelope_hash).toHaveLength(64);
  });

  it("distinguishes a parsed null product from an unparseable body", () => {
    // product_returned false means "the worker answered, with nothing".
    // product_returned null means "we could not tell". These must not collapse.
    expect(stampFromResponse(envelope({ product: null }), URL_INPUT).product_returned).toBe(false);
    expect(stampFromResponse("not json", URL_INPUT).product_returned).toBeNull();
  });

  it("treats a JSON body that is not an object without throwing", () => {
    expect(() => stampFromResponse("[]", URL_INPUT)).not.toThrow();
  });
});

describe("stampFromResponse: domain derivation", () => {
  it("uses the hostname for a url read", () => {
    expect(stampFromResponse(envelope(), URL_INPUT).domain).toBe("www.allbirds.com");
  });

  it("uses the gtin: sentinel for a barcode read", () => {
    expect(stampFromResponse(envelope(), { gtin: "8076800195057" }).domain).toBe("gtin:");
  });

  it("uses the name: sentinel for a fuzzy read", () => {
    expect(stampFromResponse(envelope(), { name: "Sony WH-1000XM5" }).domain).toBe("name:");
  });

  it("returns a null domain for an unparseable url rather than throwing", () => {
    expect(stampFromResponse(envelope(), { url: "notaurl" }).domain).toBeNull();
  });

  it("returns a null domain when no input is supplied", () => {
    expect(stampFromResponse(envelope(), {}).domain).toBeNull();
  });

  it("ignores a non-string url", () => {
    expect(stampFromResponse(envelope(), { url: 42 }).domain).toBeNull();
  });
});

describe("stampFromResponse: envelope hash", () => {
  it("is the sha256 of the exact response text", () => {
    const text = envelope();
    const expected = createHash("sha256").update(text).digest("hex");
    expect(stampFromResponse(text, URL_INPUT).envelope_hash).toBe(expected);
  });

  it("is stable across repeated calls with identical input", () => {
    const text = envelope();
    expect(stampFromResponse(text, URL_INPUT).envelope_hash).toBe(
      stampFromResponse(text, URL_INPUT).envelope_hash,
    );
  });

  it("differs when the body differs by a single character", () => {
    const a = stampFromResponse(envelope({ confidence: 0.9 }), URL_INPUT).envelope_hash;
    const b = stampFromResponse(envelope({ confidence: 0.8 }), URL_INPUT).envelope_hash;
    expect(a).not.toBe(b);
  });
});

describe("stampFromResponse: passthrough fields", () => {
  it("lifts request_id, calibration_version, cost and cached", () => {
    const s = stampFromResponse(envelope({ cached: true, cost_usd: 0.012 }), URL_INPUT);
    expect(s.request_id).toBe("req_abc");
    expect(s.calibration_version).toBe("iso-63-2026-07-05");
    expect(s.cost_usd).toBe(0.012);
    expect(s.cached).toBe(true);
  });

  it("defaults cost to 0 and cached to false when absent", () => {
    const s = stampFromResponse(envelope({ cost_usd: undefined, cached: undefined }), URL_INPUT);
    expect(s.cost_usd).toBe(0);
    expect(s.cached).toBe(false);
  });

  it("nulls request_id and calibration_version when they are not strings", () => {
    const s = stampFromResponse(envelope({ request_id: 1, calibration_version: null }), URL_INPUT);
    expect(s.request_id).toBeNull();
    expect(s.calibration_version).toBeNull();
  });
});
