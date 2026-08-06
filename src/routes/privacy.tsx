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

function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl">Privacy</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Interim policy, plain language. Final text is under counsel review before paid general
          availability. This is not legal advice.
        </p>

        <Section n="01" title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email, for magic-link sign-in.</li>
            <li>API key metadata: a one-way hash, the prefix, and the last four characters. We never store the full key.</li>
            <li>Per-call usage events: the tool, status, cost, latency, and timestamp. We do not store request bodies beyond the product reference needed to serve and cache the result.</li>
          </ul>
        </Section>

        <Section n="02" title="The product cache">
          <p>
            We cache the typed product objects we extract, keyed on public references (a URL or a
            GTIN). The cache holds factual, publicly available product data. It contains no buyer or
            end-user personal data. Entries expire on a TTL and can be purged on request.
          </p>
        </Section>

        <Section n="03" title="How we use data">
          <p>We use the above only to operate, secure, meter, and bill the API, and to provide support. We do not sell personal data.</p>
        </Section>

        <Section n="04" title="Processors we use">
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase: database and authentication.</li>
            <li>Vercel: application hosting.</li>
            <li>Stripe: subscription billing (we never see full card numbers).</li>
            <li>The public sources we extract from on your behalf, plus search and barcode providers used to resolve a query.</li>
          </ul>
        </Section>

        <Section n="05" title="Retention">
          <p>
            Usage events are retained for at least 90 days for billing and abuse prevention. Cache
            entries follow their TTL (a few days by default, shorter for volatile fields like price).
            Account data is kept while your account is active.
          </p>
        </Section>

        <Section n="06" title="Your rights and takedowns">
          <p>
            Contact us to access or delete your account data. Rights holders can request removal of
            cached product data via the takedown form, which purges matching entries promptly.
          </p>
        </Section>

        <Section n="07" title="Security">
          <p>
            Keys are stored only as hashes. Row-level security isolates each account's data, and all
            traffic is over TLS.
          </p>
        </Section>

        <p className="mt-12 text-xs text-muted-foreground">
          Interim policy. Last updated June 2026. Pending final counsel review before paid GA.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · Legibility" }] }),
  component: Privacy,
});
