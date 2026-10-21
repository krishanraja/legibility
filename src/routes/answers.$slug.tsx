import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Blocks, Inline } from "@/components/answers/Prose";
import { ANSWERS_BY_SLUG } from "@/content/answers";
import { ANSWERS_FEED_PATH, ANSWERS_PATH, answerUrl, inlineToText } from "@/lib/answers";
import { ANSWERS_OG_IMAGE, breadcrumbLd, pageMeta } from "@/lib/seo";
import { APP_ORIGIN } from "@/config/product";

/**
 * One answer page per file in src/content/answers.
 *
 * Reachable at a stable URL, server-rendered, listed in the sitemap, the feed and llms.txt,
 * and deliberately not linked from the header, footer or marketing pages. The HTML is the same
 * for every visitor: no user-agent checks, no hidden text. The direct answer is the first
 * thing on the page and the first thing in the structured data.
 */

export const Route = createFileRoute("/answers/$slug")({
  loader: ({ params }) => {
    const answer = ANSWERS_BY_SLUG[params.slug];
    // These URLs are indexed, so an unknown slug must say it is a 404 rather than render blank.
    if (!answer) throw notFound();
    return { slug: answer.slug };
  },
  head: ({ params }) => {
    const a = ANSWERS_BY_SLUG[params.slug];
    if (!a) return {};
    const url = answerUrl(a.slug);
    const answerText = inlineToText(a.answer);
    return {
      meta: [
        ...pageMeta({
          title: `${a.title} · Legibility`,
          description: a.description,
          path: `${ANSWERS_PATH}/${a.slug}`,
          type: "article",
          image: ANSWERS_OG_IMAGE,
          publishedTime: a.published,
          modifiedTime: a.updated,
          section: "Answers",
        }),
        { name: "keywords", content: a.tags.join(", ") },
      ],
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
                "@type": "Article",
                "@id": `${url}#article`,
                headline: a.title,
                description: a.description,
                abstract: answerText,
                url,
                mainEntityOfPage: url,
                datePublished: a.published,
                dateModified: a.updated,
                inLanguage: "en-GB",
                keywords: a.tags.join(", "),
                image: ANSWERS_OG_IMAGE.url,
                author: { "@id": `${APP_ORIGIN}/#org` },
                publisher: { "@id": `${APP_ORIGIN}/#org` },
                isPartOf: { "@id": `${APP_ORIGIN}/#website` },
              },
              {
                "@type": "FAQPage",
                "@id": `${url}#faq`,
                mainEntity: [
                  {
                    "@type": "Question",
                    name: a.title,
                    acceptedAnswer: { "@type": "Answer", text: answerText },
                  },
                  ...a.faq.map((f) => ({
                    "@type": "Question",
                    name: inlineToText(f.q),
                    acceptedAnswer: { "@type": "Answer", text: inlineToText(f.a) },
                  })),
                ],
              },
              breadcrumbLd([
                { name: "Legibility", path: "/" },
                { name: "Answers", path: ANSWERS_PATH },
                { name: a.title, path: `${ANSWERS_PATH}/${a.slug}` },
              ]),
            ],
          }),
        },
      ],
    };
  },
  component: AnswerPage,
});

function AnswerPage() {
  const { slug } = Route.useLoaderData();
  const a = ANSWERS_BY_SLUG[slug];
  const related = a.related.map((r) => ANSWERS_BY_SLUG[r]).filter(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <article className="mx-auto max-w-[760px] px-6 py-16">
          <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Legibility
            </Link>{" "}
            /{" "}
            <Link to="/answers" className="hover:text-foreground">
              Answers
            </Link>
          </nav>

          <h1 className="font-display mt-6 text-4xl leading-[1.1] text-balance sm:text-5xl">
            {a.title}
          </h1>

          <p className="mt-4 font-mono text-xs text-muted-foreground">
            By Legibility · Published <time dateTime={a.published}>{a.published}</time>
            {a.updated !== a.published ? (
              <>
                {" "}
                · Updated <time dateTime={a.updated}>{a.updated}</time>
              </>
            ) : null}
          </p>

          <section
            aria-label="Short answer"
            className="mt-8 rounded-md border border-hairline border-l-2 border-l-signal bg-surface p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Short answer</p>
            <p className="mt-3 text-lg leading-relaxed text-foreground">
              <Inline text={a.answer} />
            </p>
          </section>

          <div className="text-muted-foreground">
            <Blocks blocks={a.body} />
          </div>

          {a.faq.length ? (
            <section aria-labelledby="faq" className="mt-14 border-t border-hairline pt-10">
              <h2 id="faq" className="font-display text-3xl">
                FAQ
              </h2>
              <dl className="mt-6 space-y-6">
                {a.faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-semibold text-foreground">
                      <Inline text={f.q} />
                    </dt>
                    <dd className="mt-2 text-muted-foreground">
                      <Inline text={f.a} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {related.length ? (
            <section aria-labelledby="related" className="mt-14 border-t border-hairline pt-10">
              <h2
                id="related"
                className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
              >
                Related answers
              </h2>
              <ul className="mt-4 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to="/answers/$slug"
                      params={{ slug: r.slug }}
                      className="text-foreground hover:text-signal"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">
                <Link to="/answers" className="hover:text-foreground">
                  All answers
                </Link>{" "}
                ·{" "}
                <a href={ANSWERS_FEED_PATH} className="hover:text-foreground">
                  RSS feed
                </a>
              </p>
            </section>
          ) : null}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
