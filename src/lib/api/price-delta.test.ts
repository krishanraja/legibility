import { describe, expect, it } from "vitest";
import { priceDelta, type DeltaItem } from "./price-delta";

/**
 * priceDelta is the one place compare_products does arithmetic across items, so the cases that
 * matter are the ones where that arithmetic would mean nothing: no prices, prices in different
 * currencies, and prices whose currency is unknown.
 */

const at = (low: number, currency: string | null = "USD"): DeltaItem => ({
  price: { low, currency },
});

describe("priceDelta: same currency", () => {
  it("computes min, max and spread across the low prices", () => {
    expect(priceDelta([at(98.5), at(120)])).toEqual({
      price_delta: { min: 98.5, max: 120, spread: 21.5, currency: "USD" },
      price_delta_reason: null,
    });
  });

  it("rounds the spread to two decimals", () => {
    expect(priceDelta([at(98.1), at(120.3)]).price_delta?.spread).toBe(22.2);
  });

  it("treats currency codes that differ only in case or padding as the same currency", () => {
    const r = priceDelta([at(100, "usd"), at(110, " USD ")]);
    expect(r.price_delta).toEqual({ min: 100, max: 110, spread: 10, currency: "usd" });
    expect(r.price_delta_reason).toBeNull();
  });

  it("keeps the old behaviour when no item states a currency: a delta with a null currency", () => {
    const r = priceDelta([at(10, null), { price: { low: 12 } }]);
    expect(r.price_delta).toEqual({ min: 10, max: 12, spread: 2, currency: null });
  });

  it("ignores unpriced and non-finite items rather than letting them poison the arithmetic", () => {
    const r = priceDelta([at(100), { price: null }, {}, at(Number.NaN), at(Infinity)]);
    expect(r.price_delta).toEqual({ min: 100, max: 100, spread: 0, currency: "USD" });
  });

  it("takes the currency from the first item that has a price, not from an unpriced one", () => {
    // The old code took the first item with any price object, so a GBP item with no low
    // stamped "GBP" on a delta computed over USD prices.
    const r = priceDelta([{ price: { currency: "GBP" } }, at(12, "USD"), at(15, "USD")]);
    expect(r.price_delta).toEqual({ min: 12, max: 15, spread: 3, currency: "USD" });
  });
});

describe("priceDelta: no delta", () => {
  it("is null with no_priced_item when nothing carries a price", () => {
    expect(priceDelta([{ price: null }, {}])).toEqual({
      price_delta: null,
      price_delta_reason: "no_priced_item",
    });
  });

  it("is null with mixed_currencies across currencies, never a spread in the first one", () => {
    // The same product on a US and a UK storefront: USD 110 against GBP 66.
    expect(priceDelta([at(110, "USD"), at(66, "GBP")])).toEqual({
      price_delta: null,
      price_delta_reason: "mixed_currencies",
    });
  });

  it("counts an unknown currency as not matching a stated one", () => {
    expect(priceDelta([at(110, "USD"), at(66, null)]).price_delta_reason).toBe("mixed_currencies");
    expect(priceDelta([at(110, "USD"), at(66, "  ")]).price_delta_reason).toBe("mixed_currencies");
  });
});
