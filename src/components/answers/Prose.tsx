import type { ReactNode } from "react";
import { tokenizeInline, type Block } from "@/lib/answers";

/**
 * Renders the answer-hub Markdown subset as React elements.
 *
 * No dangerouslySetInnerHTML anywhere: the parse in src/lib/answers.ts produces blocks and
 * inline tokens, and each becomes an element here, so a post cannot inject markup. Humans and
 * crawlers get the same server-rendered HTML.
 */

export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = tokenizeInline(text).map((t, i) => {
    if (t.kind === "code") {
      return (
        <code key={i} className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[0.9em]">
          {t.text}
        </code>
      );
    }
    if (t.kind === "strong") {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {t.text}
        </strong>
      );
    }
    if (t.kind === "link") {
      const external = /^https?:\/\//.test(t.href) && !t.href.startsWith("https://legibility.io");
      return (
        <a
          key={i}
          href={t.href}
          className="text-signal underline underline-offset-2 hover:opacity-80"
          {...(external ? { rel: "noopener" } : {})}
        >
          {t.text}
        </a>
      );
    }
    return t.text;
  });
  return <>{out}</>;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} id={b.id} className="font-display mt-12 text-3xl text-foreground">
                <Inline text={b.text} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={b.id} className="mt-8 text-xl font-semibold text-foreground">
                <Inline text={b.text} />
              </h3>
            );
          case "code":
            return (
              <pre
                key={i}
                className="mt-5 overflow-x-auto rounded-md border border-hairline bg-surface p-5 font-mono text-sm text-foreground"
              >
                <code data-lang={b.lang}>{b.code}</code>
              </pre>
            );
          case "ul":
            return (
              <ul key={i} className="mt-5 list-disc space-y-2 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="mt-5 list-decimal space-y-2 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i} className="mt-5 leading-relaxed">
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </>
  );
}
