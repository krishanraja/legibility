import { createFileRoute } from "@tanstack/react-router";
import { ANSWERS } from "@/content/answers";
import { buildRss } from "@/lib/answers";

// RSS 2.0 feed of the answer hub at /answers/feed.xml. Built from the same parsed files as the
// pages, so a post cannot be on the site and missing from the feed. The body depends only on
// the content, so it is safe to cache.
export const Route = createFileRoute("/answers/feed.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildRss(ANSWERS), {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
