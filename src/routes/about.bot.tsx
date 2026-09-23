import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BOT_UA, BOT_TOKEN } from "@/config/product";
import { REASON_COPY, FAILURE_REASONS } from "@/lib/api/readability";

/**
 * The page LegibilityBot's user agent points at.
 *
 * Every request this product makes carries "+https://legibility.io/about/bot" in its user
 * agent, which is the convention for a crawler saying who it is. That URL was a 404, so a
 * site owner who looked up what had just hit them found nothing. For a product whose whole
 * claim is that it is a referee, the crawler being unidentifiable is not a small gap.
 *
 * It is written for the person reading their access log, so it answers their questions in
 * the order they will ask them: who is this, what did it take, how do I stop it. The block
 * instructions are real and are honoured, and they are given before the request to keep
 * access rather than after it, because a page that asks for an exception first is the kind
 * of page that gets the whole user agent banned.
 */

export const Route = createFileRoute("/about/bot")({
  head: () => ({
    meta: [
      { title: "LegibilityBot · Legibility" },
      {
        name: "description",
        content:
          "LegibilityBot requests one page, once, as a plain GET, to record whether a machine can read it. It obeys robots.txt. This page explains what it does and how to block it.",
      },
      { property: "og:title", content: "LegibilityBot · Legibility" },
      {
        property: "og:description",
        content:
          "What LegibilityBot is, exactly what it requests, and how to block it. It obeys robots.txt and a disallow is recorded as a finding rather than worked around.",
      },
    ],
  }),
  component: AboutBot,
});

/** What the bot does and does not do, stated as pairs so neither side can quietly drop. */
const BEHAVIOUR: [string, string][] = [
  [
    "One request, to your homepage",
    "A single GET. It does not crawl your site, follow internal links, or come back on a schedule unless someone checks your domain again.",
  ],
  [
    "No headless browser",
    "It does not execute your JavaScript. That is deliberate: an answer engine's crawler often does not either, so running one would flatter the result and measure the wrong thing.",
  ],
  [
    "No proxy, no residential IP",
    "The capability to route around a refusal exists and is switched off. A site that refuses a plain request is recorded as having refused, which is the finding.",
  ],
  [
    "Nothing is submitted",
    "It does not post forms, accept cookies, log in, or touch anything behind an account.",
  ],
  [
    "It reads the markup, not the people",
    "What gets recorded is whether structured data was present and parseable. No personal data is collected from your pages, and no buyer data exists in this product at all.",
  ],
];

function AboutBot() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Crawler identity
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance">
              You found this in your access log.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              LegibilityBot requested one page from your site. It was almost certainly because
              someone entered your domain into the free checker at{" "}
              <Link to="/" className="text-signal underline underline-offset-4">
                legibility.io
              </Link>
              , which reads a single page and reports whether a machine can extract typed facts from
              it.
            </p>

            <pre className="mt-8 overflow-x-auto rounded-md border border-hairline bg-surface p-5 font-mono text-xs leading-relaxed text-muted-foreground">
              {`User-Agent: ${BOT_UA}`}
            </pre>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §01 · behaviour
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance">What it does.</h2>
            </div>
            <dl className="divide-y divide-hairline border-y border-hairline">
              {BEHAVIOUR.map(([term, detail]) => (
                <div key={term} className="py-5">
                  <dt className="font-display text-xl text-foreground">{term}</dt>
                  <dd className="mt-2 text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §02 · how to block it
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance">
                If you would rather it did not.
              </h2>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p>
                Add this to your robots.txt. It is checked before the page is requested, so a
                disallow means the page is never fetched at all.
              </p>
              <pre className="overflow-x-auto rounded-md border border-hairline bg-surface p-5 font-mono text-xs leading-relaxed">
                {`User-agent: ${BOT_TOKEN}\nDisallow: /`}
              </pre>
              <p>
                A site that blocks us is recorded as having chosen to, and that is published as a
                finding rather than treated as an obstacle to get around. We do not retry from a
                different address, and we do not interpret a refusal as a technical fault.
              </p>
              <p>
                To remove a page we have already read,{" "}
                <Link to="/takedown" className="text-signal underline underline-offset-4">
                  file a takedown
                </Link>
                . We honour it within 24 hours.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §03 · what it records
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance">
                One verdict, from a closed list.
              </h2>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p>
                A page is readable when typed facts can be extracted from it without guessing, which
                in practice means JSON-LD or OpenGraph. When it is not readable, the reason is one
                of these and nothing else. There is no free-text judgement of your site anywhere in
                this product.
              </p>
              <dl className="divide-y divide-hairline border-y border-hairline">
                {FAILURE_REASONS.map((reason) => (
                  <div
                    key={reason}
                    className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[200px_1fr]"
                  >
                    <dt className="font-mono text-xs uppercase tracking-widest text-signal">
                      {reason}
                    </dt>
                    <dd className="text-sm">{REASON_COPY[reason]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
