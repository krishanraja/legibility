import { describe, expect, it } from "vitest";
import { ANSWERS_OG_IMAGE, DEFAULT_OG_IMAGE, absoluteUrl, breadcrumbLd, pageMeta } from "./seo";

const get = (tags: ReturnType<typeof pageMeta>, key: string) =>
  tags.find((t) => ("name" in t && t.name === key) || ("property" in t && t.property === key));

describe("absoluteUrl", () => {
  it("matches the canonical shape", () => {
    expect(absoluteUrl("/")).toBe("https://legibility.io/");
    expect(absoluteUrl("")).toBe("https://legibility.io/");
    expect(absoluteUrl("docs/mcp/")).toBe("https://legibility.io/docs/mcp");
  });
});

describe("pageMeta", () => {
  it("emits the full social set with image dimensions", () => {
    const tags = pageMeta({ title: "T", description: "D", path: "/docs/mcp" });
    expect(tags[0]).toEqual({ title: "T" });
    expect(get(tags, "og:url")).toMatchObject({ content: "https://legibility.io/docs/mcp" });
    expect(get(tags, "og:type")).toMatchObject({ content: "website" });
    expect(get(tags, "og:site_name")).toMatchObject({ content: "Legibility" });
    expect(get(tags, "og:image")).toMatchObject({ content: DEFAULT_OG_IMAGE.url });
    expect(get(tags, "og:image:width")).toMatchObject({ content: "1200" });
    expect(get(tags, "og:image:height")).toMatchObject({ content: "630" });
    expect(get(tags, "twitter:card")).toMatchObject({ content: "summary_large_image" });
    expect(get(tags, "twitter:image:alt")).toMatchObject({ content: DEFAULT_OG_IMAGE.alt });
    expect(get(tags, "article:published_time")).toBeUndefined();
  });

  it("adds article fields only for articles", () => {
    const tags = pageMeta({
      title: "T",
      description: "D",
      path: "/answers/x",
      type: "article",
      image: ANSWERS_OG_IMAGE,
      publishedTime: "2026-10-21",
      modifiedTime: "2026-10-22",
      section: "Answers",
    });
    expect(get(tags, "article:published_time")).toMatchObject({ content: "2026-10-21" });
    expect(get(tags, "article:modified_time")).toMatchObject({ content: "2026-10-22" });
    expect(get(tags, "article:section")).toMatchObject({ content: "Answers" });
    expect(get(tags, "og:image")).toMatchObject({ content: ANSWERS_OG_IMAGE.url });
    const bare = pageMeta({ title: "T", description: "D", path: "/x", type: "article" });
    expect(get(bare, "article:published_time")).toBeUndefined();
  });
});

describe("breadcrumbLd", () => {
  it("numbers items from one with absolute URLs", () => {
    expect(
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "A", path: "/a" },
      ]),
    ).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://legibility.io/" },
        { "@type": "ListItem", position: 2, name: "A", item: "https://legibility.io/a" },
      ],
    });
  });
});
