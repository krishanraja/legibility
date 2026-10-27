import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_COPY, parseFoundingInput, reportFrom } from "@/lib/api/founding";
import { EmailStep, Intro, ReportCard, RunForm, Sent, Welcome } from "./FoundingViews";

/**
 * A3, tests 6 and 7: every state the Founding 200 page can show, rendered, then checked: the
 * key, the report and a curl with the builder's own input after verification; the coverage note
 * and no call offer for a non-fit entrant; and nowhere a booking link, an em dash, a mainnet
 * claim or a promise beyond the offer.
 */

const noop = () => undefined;
// Synthetic only.
const KEY = "lgk_synthetic_rendered_once";
const ROLE = ["listings", "legibility.io"].join("@");
const INPUT = parseFoundingInput("https://shop.example/products/wool-runner")!;
const TRUSTED = reportFrom({
  product: {
    title: "Wool Runner",
    brand: "Brand",
    price: { low: 110, high: 110, currency: "USD" },
  },
  confidence: 0.93,
  method: "shopify",
  cost_usd: 0.004,
});
const MISS = reportFrom({ product: null, confidence: 0.1, method: null, cost_usd: 0 });

const states = {
  intro: <Intro />,
  introAutoTrial: <Intro autoTrial />,
  form: (
    <RunForm
      values={{ input: "", use_case: "", interface: "rest", stores: "" }}
      onChange={noop}
      onSubmit={noop}
      busy={false}
      message="The test is paused right now. Nothing has been charged to anyone."
      challenge={null}
    />
  ),
  fit: <ReportCard report={TRUSTED} trusted />,
  nonFit: <ReportCard report={MISS} trusted={false} />,
  email: <EmailStep email="" onEmail={noop} onSubmit={noop} busy={false} />,
  sent: <Sent />,
  welcomeFit: (
    <Welcome apiKey={KEY} keyHint={null} input={INPUT} report={TRUSTED} trusted contact={ROLE} />
  ),
  welcomeNonFit: (
    <Welcome
      apiKey={KEY}
      keyHint={null}
      input={INPUT}
      report={MISS}
      trusted={false}
      contact={ROLE}
    />
  ),
  welcomeHasKey: (
    <Welcome
      apiKey={null}
      keyHint="lgk_abcdefgh...wxyz"
      input={INPUT}
      report={TRUSTED}
      trusted
      contact={null}
    />
  ),
};

const html = Object.fromEntries(
  Object.entries(states).map(([k, el]) => [k, renderToStaticMarkup(el)]),
) as Record<keyof typeof states, string>;

describe("the Founding 200 page", () => {
  it.each(Object.keys(states))(
    "7. %s has no booking link, em dash, mainnet claim or promise beyond the offer",
    (k) => {
      const text = html[k as keyof typeof states];
      for (const re of FORBIDDEN_COPY) expect(text, `${k}: ${re.source}`).not.toMatch(re);
      expect(text).not.toMatch(/href="[^"]*(calendly|cal\.com|calendar)/i);
    },
  );

  it("1. asks for no email before the result", () => {
    expect(html.form).not.toMatch(/type="email"/);
    expect(html.email).toMatch(/type="email"/);
  });

  it("states the one offer with free beside the trial", () => {
    expect(html.intro).toContain("30-day free trial in exchange for feedback");
    expect(html.intro).toContain("up to 1,000 trusted reads a month");
  });

  it("c7. with FOUNDING_AUTO_TRIAL on, the page states the trial a new key gets, not Free's", () => {
    expect(html.introAutoTrial).toContain("30-day free trial in exchange for feedback");
    expect(html.introAutoTrial).toContain("up to 5,000 trusted reads over 30 days");
    expect(html.introAutoTrial).not.toContain("1,000 trusted reads a month");
    expect(html.intro).not.toContain("5,000");
  });

  it("6. after verification: the key once, the report, and a curl and MCP config with their own input", () => {
    expect(html.welcomeFit).toContain(KEY);
    expect(html.welcomeFit).toContain("Wool Runner");
    expect(html.welcomeFit).toContain("https://shop.example/products/wool-runner");
    expect(html.welcomeFit).toContain("https://legibility.io/api/mcp");
    expect(html.welcomeFit).toContain(ROLE);
    expect(html.welcomeHasKey).toContain("lgk_abcdefgh...wxyz");
    expect(html.welcomeHasKey).toContain("lgk_your_key");
  });

  it("6. a non-fit entrant sees the coverage note and no call offer", () => {
    expect(html.welcomeNonFit).toContain("could not read this product with confidence");
    expect(html.welcomeNonFit).not.toContain("25-minute call");
    expect(html.welcomeNonFit).not.toContain(ROLE);
    expect(html.welcomeHasKey).not.toContain("25-minute call");
  });
});
