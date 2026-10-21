import { APP_ORIGIN } from "@/config/product";

/**
 * One definition of the per-page social and search metadata.
 *
 * Before this, every route wrote its own head by hand and most stopped at title and
 * description. The result was that every page except the homepage shared the homepage's
 * og:url and twitter:title, so a link to /docs/mcp unfurled as the front page. A crawler
 * reading og:url saw one URL for twenty pages.
 *
 * TanStack merges head meta by name or property with the deepest route winning, so the root
 * route sets site-wide defaults (image, site name, card type) and each page overrides the
 * fields that are its own by calling pageMeta.
 */

export const SITE_NAME = "Legibility";

export type OgImage = { url: string; width: number; height: number; alt: string };

export const DEFAULT_OG_IMAGE: OgImage = {
  url: `${APP_ORIGIN}/og.png`,
  width: 1200,
  height: 630,
  alt: "Legibility: can a machine read your website? Shows what an AI crawler sees, with a REST and MCP API that agents can pay per call.",
};

export const ANSWERS_OG_IMAGE: OgImage = {
  url: `${APP_ORIGIN}/og-answers.png`,
  width: 1200,
  height: 630,
  alt: "Legibility answers: straight answers for agent builders on MCP, x402 and typed product data.",
};

/**
 * Absolute canonical URL for a path, in the same shape as the canonical link and the sitemap:
 * "/" keeps its slash, everything else has none.
 */
export function absoluteUrl(path: string): string {
  if (path === "" || path === "/") return `${APP_ORIGIN}/`;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP_ORIGIN}${p.replace(/\/+$/, "")}`;
}

export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | {
      property: string;
      content: string;
    };

export type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: OgImage;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
};

/** The full title, description, Open Graph and Twitter set for one page. */
export function pageMeta(input: PageMetaInput): MetaTag[] {
  const url = absoluteUrl(input.path);
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const tags: MetaTag[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_GB" },
    { property: "og:image", content: image.url },
    { property: "og:image:secure_url", content: image.url },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: String(image.width) },
    { property: "og:image:height", content: String(image.height) },
    { property: "og:image:alt", content: image.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image.url },
    { name: "twitter:image:alt", content: image.alt },
  ];
  if (input.type === "article") {
    if (input.publishedTime) {
      tags.push({ property: "article:published_time", content: input.publishedTime });
    }
    if (input.modifiedTime) {
      tags.push({ property: "article:modified_time", content: input.modifiedTime });
    }
    if (input.section) tags.push({ property: "article:section", content: input.section });
  }
  return tags;
}

/** schema.org BreadcrumbList from (name, path) pairs, root first. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}
