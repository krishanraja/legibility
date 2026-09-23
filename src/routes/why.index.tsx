import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { REASON_COPY } from "@/lib/api/readability";
import { REASON_PAGES, REASON_PAGE_ORDER } from "@/content/reasons";
import { APP_ORIGIN } from "@/config/product";

/**
 * The hub for the eight findings.
 *
 * It exists as a page rather than only as a nav element because the set itself is the claim:
 * that "a machine cannot read this" is not one problem but eight, with different causes,
 * different costs and different people who fix them. That distinction is the product, and
 * until now it was stated only inside a result card.
 *
 * Ordered by what the finding costs rather than alphabetically, and the two that cost nothing
 * are still here and still labelled, because a taxonomy that only contains problems is a sales
 * sheet.
 */

const SUMMARY =
  "A machine failing to read a page is not one problem. It is eight, with different causes and different costs: content assembled by JavaScript, no structured data, a refusal, an extraction below the trust gate, a robots.txt rule, a page that is not a product, a timeout, or an inconclusive read.";

export const Route = createFileRoute("/why/")({
  head: () => ({
    meta: [
      { title: "Why a machine cannot read a page · Legibility" },
      { name: "description", content: SUMMARY },
      { property: "og:title", content: "Why a machine cannot read a page · Legibility" },
      { property: "og:description", content: SUMMARY },
      { property: "og:url", content: `${APP_ORIGIN}/why` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": `${APP_ORIGIN}/why#page`,
              name: "Why a machine cannot read a page",
              description: SUMMARY,
              url: `${APP_ORIGIN}/why`,
              isPartOf: { "@id": `${APP_ORIGIN}/#website` },
              hasPart: REASON_PAGE_ORDER.map((r) => ({
                "@type": "TechArticle",
                "@id": `${APP_ORIGIN}/why/${r}#article`,
                headline: REASON_PAGES[r].title,
                description: REASON_PAGES[r].summary,
                url: `${APP_ORIGIN}/why/${r}`,
              })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Legibility", item: APP_ORIGIN },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Why a page cannot be read",
                  item: `${APP_ORIGIN}/why`,
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: WhyIndex,
});

function WhyIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              The closed set
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance">
              Unreadable is not one problem.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              When a machine cannot read a page, the reason matters more than the verdict. A site
              that refuses crawlers made a decision. A site that renders only in JavaScript did not.
              A site with clean HTML and no markup is one afternoon away from being fixed. Those are
              different problems with different costs, so they are recorded separately.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-foreground">
              This is the whole list. There is no ninth reason and no free-text judgement of your
              site anywhere in this product.
            </p>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto max-w-[1280px] px-6 py-20">
            <div className="divide-y divide-hairline border-y border-hairline">
              {REASON_PAGE_ORDER.map((r) => (
                <Link
                  key={r}
                  to="/why/$reason"
                  params={{ reason: r }}
                  className="group grid grid-cols-1 gap-3 py-6 sm:grid-cols-[200px_1fr]"
                >
                  <div className="font-mono text-xs uppercase tracking-widest text-signal">{r}</div>
                  <div>
                    <div className="font-display text-2xl text-foreground group-hover:underline">
                      {REASON_PAGES[r].title}
                    </div>
                    <p className="mt-1 text-muted-foreground">{REASON_COPY[r]}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-16">
            <p className="text-muted-foreground">
              To find out which of these applies to your own site, the check on the front page reads
              one page and returns one of exactly these eight answers.
            </p>
            <a
              href="/#check"
              className="mt-5 inline-block rounded-sm bg-signal px-4 py-2 font-mono text-xs text-background hover:opacity-90"
            >
              See what a machine sees
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
