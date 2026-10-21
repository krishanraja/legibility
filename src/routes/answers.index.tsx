import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Inline } from "@/components/answers/Prose";
import { ANSWERS } from "@/content/answers";
import { ANSWERS_FEED_PATH, ANSWERS_PATH, answerUrl } from "@/lib/answers";
import { ANSWERS_OG_IMAGE, absoluteUrl, breadcrumbLd, pageMeta } from "@/lib/seo";
import { APP_ORIGIN } from "@/config/product";

/**
 * The answer hub index: every post, newest first.
 *
 * Not linked from the site chrome on purpose. It is a reference shelf for people and agents who
 * arrive from a search, an assistant, the sitemap, the feed or llms.txt, not a marketing
 * surface. It is still an ordinary public page: same HTML for everyone, server-rendered.
 */

const TITLE = "Answers · Legibility";
const DESCRIPTION =
  "Direct answers to the questions developers and agents ask about MCP servers, paying per call in USDC with x402, and reading typed product data with a calibrated confidence.";

export const Route = createFileRoute("/answers/")({
  head: () => ({
    meta: pageMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: ANSWERS_PATH,
      image: ANSWERS_OG_IMAGE,
    }),
    links: [
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Legibility answers",
        href: `${APP_ORIGIN}${ANSWERS_FEED_PATH}`,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": `${absoluteUrl(ANSWERS_PATH)}#page`,
              name: "Legibility answers",
              description: DESCRIPTION,
              url: absoluteUrl(ANSWERS_PATH),
              isPartOf: { "@id": `${APP_ORIGIN}/#website` },
              publisher: { "@id": `${APP_ORIGIN}/#org` },
              mainEntity: {
                "@type": "ItemList",
                itemListElement: ANSWERS.map((a, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: answerUrl(a.slug),
                  name: a.title,
                })),
              },
            },
            breadcrumbLd([
              { name: "Legibility", path: "/" },
              { name: "Answers", path: ANSWERS_PATH },
            ]),
          ],
        }),
      },
    ],
  }),
  component: AnswersIndex,
});

function AnswersIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Answers</p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance">
              Straight answers for agent builders.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{DESCRIPTION}</p>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              <a href={ANSWERS_FEED_PATH} className="hover:text-foreground">
                RSS feed
              </a>{" "}
              ·{" "}
              <a href="/llms.txt" className="hover:text-foreground">
                llms.txt
              </a>
            </p>
          </div>
        </section>

        <section>
          <ol className="mx-auto max-w-[820px] divide-y divide-hairline px-6 py-6">
            {ANSWERS.map((a) => (
              <li key={a.slug} className="py-8">
                <h2 className="font-display text-3xl leading-tight">
                  <Link to="/answers/$slug" params={{ slug: a.slug }} className="hover:text-signal">
                    {a.title}
                  </Link>
                </h2>
                <p className="mt-3 text-muted-foreground">
                  <Inline text={a.answer} />
                </p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  Updated <time dateTime={a.updated}>{a.updated}</time> · {a.tags.join(", ")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
