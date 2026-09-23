import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import {
  FAILURE_REASONS,
  REASON_COPY,
  REASON_FIX,
  type FailureReason,
} from "@/lib/api/readability";
import { REASON_PAGES, REASON_PAGE_ORDER } from "@/content/reasons";
import { APP_ORIGIN } from "@/config/product";

/**
 * One page per failure reason.
 *
 * The eight glosses in REASON_COPY were the best short explanations on the site and they were
 * visible only inside a result card, which is to say never to a crawler and never to anyone
 * who had not already run a check. They are the most quotable thing this product owns: eight
 * specific, named, mechanical answers to "why can a machine not read this page", which is a
 * question people are now asking assistants.
 *
 * Generated from the closed set rather than hand-written per page, so a reason cannot exist in
 * the classifier and be missing here, and the explanation someone reads on this page is the
 * same string the verdict showed them.
 */

function isReason(s: string): s is FailureReason {
  return (FAILURE_REASONS as readonly string[]).includes(s);
}

export const Route = createFileRoute("/why/$reason")({
  loader: ({ params }) => {
    // An unknown slug is a 404, not a blank page that renders the word "undefined". These
    // URLs are indexed, so a wrong one must say it is wrong.
    if (!isReason(params.reason)) throw notFound();
    return { reason: params.reason };
  },
  head: ({ params }) => {
    if (!isReason(params.reason)) return {};
    const page = REASON_PAGES[params.reason];
    const url = `${APP_ORIGIN}/why/${params.reason}`;
    return {
      meta: [
        { title: `${page.title} · Legibility` },
        { name: "description", content: page.summary },
        { property: "og:title", content: `${page.title} · Legibility` },
        { property: "og:description", content: page.summary },
        { property: "og:url", content: url },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "TechArticle",
                "@id": `${url}#article`,
                headline: page.title,
                description: page.summary,
                url,
                about: params.reason,
                isPartOf: { "@id": `${APP_ORIGIN}/#website` },
                publisher: { "@id": `${APP_ORIGIN}/#org` },
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
                  { "@type": "ListItem", position: 3, name: page.title, item: url },
                ],
              },
            ],
          }),
        },
      ],
    };
  },
  component: ReasonPage,
});

function ReasonPage() {
  const { reason } = Route.useLoaderData();
  const page = REASON_PAGES[reason];
  const others = REASON_PAGE_ORDER.filter((r) => r !== reason);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              <Link to="/why" className="hover:underline">
                Why a page cannot be read
              </Link>{" "}
              · {reason}
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance">{page.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.summary}</p>
            <p className="mt-6 border-l-2 border-signal pl-5 text-foreground">
              {REASON_COPY[reason]}
            </p>
          </div>
        </section>

        <Block n="01" heading="What is actually happening" paras={page.what} />
        <Block n="02" heading="What it costs" paras={page.cost} surface />

        <section className="border-b border-hairline">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §03 · what would change it
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance">The fix.</h2>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p className="text-foreground">{REASON_FIX[reason]}</p>
              <p>
                <span className="text-foreground">Who does it. </span>
                {page.effort}
              </p>
              <div className="rounded-md border border-hairline bg-surface p-6">
                <p className="text-foreground">Check your own site.</p>
                <p className="mt-2 text-sm">
                  One request, one verdict, no account. If this is the finding you get back, the
                  page above is the one that applies.
                </p>
                <a
                  href="/#check"
                  className="mt-4 inline-block rounded-sm bg-signal px-3 py-2 font-mono text-xs text-background hover:opacity-90"
                >
                  See what a machine sees
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto max-w-[1280px] px-6 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              The other findings
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((r) => (
                <Link
                  key={r}
                  to="/why/$reason"
                  params={{ reason: r }}
                  className="block rounded-md border border-hairline bg-background p-4 hover:border-signal"
                >
                  <div className="font-mono text-xs text-signal">{r}</div>
                  <div className="mt-1 text-sm text-foreground">{REASON_PAGES[r].title}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Block({
  n,
  heading,
  paras,
  surface,
}: {
  n: string;
  heading: string;
  paras: string[];
  surface?: boolean;
}) {
  return (
    <section className={`border-b border-hairline${surface ? " bg-surface/40" : ""}`}>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            §{n} · {heading.toLowerCase()}
          </p>
          <h2 className="font-display mt-3 text-4xl text-balance">{heading}.</h2>
        </div>
        <div className="space-y-5 text-muted-foreground">
          {paras.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
