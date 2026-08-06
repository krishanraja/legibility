import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">
        <span className="mr-3 font-mono text-sm text-muted-foreground">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl">Terms of service</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Interim terms, plain language. Final text is under counsel review before paid general
          availability. This is not legal advice.
        </p>

        <Section n="01" title="The service">
          <p>
            Legibility turns a product URL, a GTIN barcode, or a fuzzy product name into a typed product
            object: factual attributes, a price expressed as a band, per-field and overall
            confidence, the source method, and the per-call cost. It is offered over a REST API and an
            MCP server.
          </p>
        </Section>

        <Section n="02" title="Accounts and API keys">
          <p>
            You are responsible for keeping your secret key (lgk_) confidential. Every call made with
            your key is treated as made by you and is billed to your account. Rotate or revoke a key
            from your dashboard if it is exposed.
          </p>
        </Section>

        <Section n="03" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>exceed your plan's rate limits or share a key to circumvent them;</li>
            <li>use Legibility to bypass authentication, paywalls, CAPTCHAs, or anti-bot controls on any source;</li>
            <li>resell or redistribute the raw cache as a bulk dataset;</li>
            <li>use the service for unlawful purposes or in violation of a source site's terms.</li>
          </ul>
          <p>You are responsible for ensuring your downstream use complies with applicable law.</p>
        </Section>

        <Section n="04" title="Data and intellectual property">
          <p>
            Legibility extracts publicly available, factual product data (titles, identifiers, specs,
            availability, and price observations) and caches it to serve future calls. We do not
            provide product images or verbatim creative descriptions. Factual data is not owned by
            Legibility; you are granted the right to use the returned objects in your application.
          </p>
        </Section>

        <Section n="05" title="Accuracy: confidence and price bands">
          <p>
            Confidence scores are model outputs, not guarantees. Price is returned as a band with a
            timestamp and source count, never as a single live quote. Do not rely on a value for a
            high-stakes decision without your own verification. Results below the 0.7 confidence gate
            are not returned as trusted.
          </p>
        </Section>

        <Section n="06" title="Billing">
          <p>
            Paid plans are billed monthly via Stripe. Usage is metered per call; a cached read is
            billed at a fraction of a live extraction. Overage above your included calls is billed on
            the same invoice. Autonomous agents may also pay per call via x402 (USDC on Base);
            x402 payments are independent of any Stripe account.
          </p>
        </Section>

        <Section n="07" title="Refunds">
          <p>
            Interim policy: metered usage fees are non-refundable. Subscription issues are handled
            case by case; contact support and we will make it right where reasonable. You can cancel a
            subscription at any time from the billing portal; access continues to the end of the paid
            period.
          </p>
        </Section>

        <Section n="08" title="Takedowns">
          <p>
            Rights holders may request removal of cached data via the takedown form. We purge matching
            cache entries promptly and can block re-caching of a source on request.
          </p>
        </Section>

        <Section n="09" title="Warranty, liability, and indemnity">
          <p>
            The service is provided "as is" without warranties of any kind. To the maximum extent
            permitted by law, Legibility is not liable for indirect or consequential damages, and total
            liability is limited to the fees you paid in the prior three months. You agree to
            indemnify Legibility for claims arising from your downstream use of the data.
          </p>
        </Section>

        <Section n="10" title="Termination and changes">
          <p>
            Either party may stop the service at any time. We may update these terms; material changes
            will be noted here with a new date. Governing law and venue will be finalized with counsel
            before paid GA.
          </p>
        </Section>

        <p className="mt-12 text-xs text-muted-foreground">
          Interim terms. Last updated June 2026. Pending final counsel review before paid GA.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · Legibility" }] }),
  component: Terms,
});
