import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { pageMeta } from "@/lib/seo";

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
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-5xl">Privacy</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Interim policy, plain language. Final text is under counsel review before paid general
          availability. This is not legal advice.
        </p>
        <p className="mt-6 text-muted-foreground">
          Legibility is operated by Mindmaker LLC, a United States company, and Mindmaker Ltd, a
          United Kingdom company (together, "Mindmaker", "we", "us"). Mindmaker LLC and Mindmaker
          Ltd are responsible for the personal information described in this policy. Contact us at{" "}
          <a href="mailto:founders@legibility.io" className="underline hover:text-foreground">
            founders@legibility.io
          </a>
          .
        </p>

        <Section n="01" title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email, for magic-link sign-in.</li>
            <li>
              API key metadata: a one-way hash, the prefix, and the last four characters. We never
              store the full key.
            </li>
            <li>
              Per-call usage events: the tool, status, cost, latency, and timestamp. We do not store
              request bodies beyond the product reference needed to serve and cache the result.
            </li>
          </ul>
        </Section>

        <Section n="02" title="Cookies and where you came from">
          <p>
            When you arrive from a link that carries campaign tags (the utm parameters in a link we
            sent or listed), or from an MCP directory that lists Legibility, we keep a first-party
            cookie called lg_touch for 30 days. It holds only those tags, the name of the site that
            sent you (never the page or anything after it), the directory, and the time you arrived.
            It never holds your email, your IP address or anything you type.
          </p>
          <p>
            If you then create an account or an API key, we record the same details against it, and
            the name of the software that first uses the key (for example curl), so we know which
            channel brought you. We use this only to understand which of our own invitations and
            listings work.
          </p>
          <p>
            We also measure how the site is used with Google Analytics and PostHog. The sign-up
            events we send them carry only the campaign tag and the channel name, never your email,
            IP address, product inputs or keys.
          </p>
          <p>
            If you leave your email on the home page after a free check, PostHog links that email to
            your earlier visits on this site, so we can follow up on the check you ran.
          </p>
        </Section>

        <Section n="03" title="The Founding 200 test">
          <p>
            When you run the test on the Founding 200 page, we keep the product URL or barcode you
            entered, what you told us you are building, how you will call Legibility and which
            stores matter to you, with the result of the read. We use them to show you the report
            and, if you create an account, to attach them to it. We count runs against daily limits
            using a one-way hash of your IP address; the address itself is not stored. The product
            URL or barcode you entered is never shared outside Legibility.
          </p>
        </Section>

        <Section n="04" title="The product cache">
          <p>
            We cache the typed product objects we extract, keyed on public references (a URL or a
            GTIN). The cache holds factual, publicly available product data. It contains no buyer or
            end-user personal data. Entries expire on a TTL and can be purged on request.
          </p>
        </Section>

        <Section n="05" title="How we use data">
          <p>
            We use the above only to operate, secure, meter, and bill the API, and to provide
            support. We do not sell personal data.
          </p>
        </Section>

        <Section n="06" title="Processors we use">
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase: database and authentication.</li>
            <li>Vercel: application hosting.</li>
            <li>Stripe: subscription billing (we never see full card numbers).</li>
            <li>Google Analytics and PostHog: measuring how the site is used.</li>
            <li>
              Cloudflare Turnstile: checking that a test run on the Founding 200 page comes from a
              person.
            </li>
            <li>
              The public sources we extract from on your behalf, plus search and barcode providers
              used to resolve a query.
            </li>
          </ul>
        </Section>

        <Section n="07" title="Retention">
          <p>
            Usage events are retained for at least 90 days for billing and abuse prevention. Cache
            entries follow their TTL (a few days by default, shorter for volatile fields like
            price). Account data is kept while your account is active.
          </p>
        </Section>

        <Section n="08" title="Your rights and takedowns">
          <p>
            Contact us to access or delete your account data. Rights holders can request removal of
            cached product data via the takedown form, which purges matching entries promptly.
          </p>
        </Section>

        <Section n="09" title="Security">
          <p>
            Keys are stored only as hashes. Row-level security isolates each account's data, and all
            traffic is over TLS.
          </p>
        </Section>

        <p className="mt-12 text-xs text-muted-foreground">
          Interim policy. Last updated: 27 October 2026. Pending final counsel review before paid
          GA.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: pageMeta({
      title: "Privacy · Legibility",
      description: "The privacy policy for Legibility at legibility.io.",
      path: "/privacy",
    }),
  }),
  component: Privacy,
});
