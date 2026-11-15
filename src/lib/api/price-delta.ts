// The price delta compare_products returns, extracted from the route so the judgment is
// tested directly, the same way composeBrief is.
//
// A delta is arithmetic across prices, and arithmetic across currencies is meaningless:
// USD 110 against GBP 66 is not a spread of 44 in either currency. The route used to take the
// lows from every priced item and stamp the first item's currency on the result, so a
// cross-region comparison (the same product on a .com and a .co.uk storefront) returned a
// confident, wrong number. Now the delta is computed only when every priced item carries the
// same currency. When they do not, the delta is null, the reason says why, and each item still
// carries its own price and currency for the caller to read.
//
// Deliberately no currency conversion here. An exchange rate is a second source with its own
// date and its own provenance, and the price band does not borrow one silently.

export type DeltaItem = {
  price?: { low?: number; currency?: string | null } | null;
};

export type PriceDelta = {
  min: number;
  max: number;
  spread: number;
  currency: string | null;
};

/** Why price_delta is null. Null itself when a delta was computed. */
export type PriceDeltaReason = "no_priced_item" | "mixed_currencies";

export type PriceDeltaResult = {
  price_delta: PriceDelta | null;
  price_delta_reason: PriceDeltaReason | null;
};

function currencyKey(c: string | null | undefined): string | null {
  const k = typeof c === "string" ? c.trim().toUpperCase() : "";
  return k.length ? k : null;
}

export function priceDelta(items: DeltaItem[]): PriceDeltaResult {
  const priced = items.filter(
    (i): i is { price: { low: number; currency?: string | null } } =>
      typeof i.price?.low === "number" && Number.isFinite(i.price.low),
  );
  if (!priced.length) return { price_delta: null, price_delta_reason: "no_priced_item" };

  // A missing currency cannot be confirmed to match a stated one, so it counts as its own key.
  const currencies = new Set(priced.map((i) => currencyKey(i.price.currency)));
  if (currencies.size > 1) return { price_delta: null, price_delta_reason: "mixed_currencies" };

  const lows = priced.map((i) => i.price.low);
  const min = Math.min(...lows);
  const max = Math.max(...lows);
  return {
    price_delta: {
      min,
      max,
      spread: Number((max - min).toFixed(2)),
      currency: priced[0].price.currency ?? null,
    },
    price_delta_reason: null,
  };
}
