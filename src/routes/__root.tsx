import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { APP_ORIGIN, MCP_URL, API_BASE } from "@/config/product";
import { pageMeta } from "@/lib/seo";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { GA_INLINE, GA_SCRIPT_SRC } from "@/lib/google-tag";
import { recordLanding } from "@/lib/attribution-client";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Site-wide defaults. Every public route overrides title, description, og:url and the
      // twitter fields through pageMeta; these cover any route that does not.
      ...pageMeta({
        title: "Legibility · Can a machine read your website?",
        description:
          "Legibility measures whether a machine can read a website, and records why when it cannot. Enter a domain and see what an AI crawler sees. Method and sample size published with every figure.",
        path: "/",
      }),
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "application-name", content: "Legibility" },
      { name: "apple-mobile-web-app-title", content: "Legibility" },
      { name: "author", content: "Legibility" },
      // Browser chrome colour, matched to the page background (cream). One tag only: TanStack
      // keeps a single meta per name, so a light/dark pair would silently lose one half.
      { name: "theme-color", content: "#F4EFE6" },
    ],
    // JSON-LD structured data: what Google rich results AND AI answer engines consume.
    // Fitting for a product-data company to ship clean structured data about itself.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://legibility.io/#org",
              name: "Legibility",
              url: "https://legibility.io",
              logo: {
                "@type": "ImageObject",
                url: "https://legibility.io/icon-512.png",
                width: 512,
                height: 512,
              },
              description:
                "Legibility measures whether a machine can read a website. It publishes which well-known sites an AI crawler cannot read and why, and offers the same reading engine as an API.",
            },
            {
              "@type": "WebSite",
              "@id": "https://legibility.io/#website",
              url: "https://legibility.io",
              name: "Legibility",
              inLanguage: "en-GB",
              publisher: { "@id": "https://legibility.io/#org" },
            },
            {
              "@type": "SoftwareApplication",
              "@id": "https://legibility.io/#app",
              name: "Legibility",
              provider: { "@id": "https://legibility.io/#org" },
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web (REST API and MCP server)",
              url: "https://legibility.io",
              description:
                "Measures whether a machine can read a web page and records why when it cannot: a refusal, a JavaScript-only render, or an absence of structured data. Free domain check, plus a REST and MCP reading engine priced per call.",
              offers: [
                {
                  "@type": "Offer",
                  name: "Free",
                  price: "0",
                  priceCurrency: "USD",
                  description: "1,000 trusted reads per month, no card",
                },
                {
                  "@type": "Offer",
                  name: "Starter",
                  price: "29",
                  priceCurrency: "USD",
                  description: "5,000 trusted reads per month",
                },
                {
                  "@type": "Offer",
                  name: "Growth",
                  price: "199",
                  priceCurrency: "USD",
                  description: "50,000 trusted reads per month",
                },
              ],
            },
            // The two machine surfaces, described for agents and API directories. Stated as
            // they are today: MCP carries two tools, x402 settles on a testnet.
            {
              "@type": "WebAPI",
              "@id": "https://legibility.io/#rest-api",
              name: "Legibility REST API",
              description:
                "POST /api/v1/<tool> for read_product, resolve_product, compare_products and brief_product. Typed product objects with calibrated confidence, a price band and the cost of the call. Authenticated with an lgk_ API key as a Bearer token.",
              url: API_BASE,
              documentation: "https://legibility.io/docs",
              termsOfService: "https://legibility.io/terms",
              provider: { "@id": "https://legibility.io/#org" },
            },
            {
              "@type": "WebAPI",
              "@id": "https://legibility.io/#mcp",
              name: "Legibility MCP server",
              description:
                "Model Context Protocol server (JSON-RPC 2.0 over HTTP POST, protocol 2025-06-18) exposing read_product and resolve_product. Discovery is free. tools/call is paid with an API key or per call in USDC over x402 on Base Sepolia (testnet; no mainnet settlement yet). Discovery document at /.well-known/mcp.json.",
              url: MCP_URL,
              documentation: "https://legibility.io/docs/mcp",
              termsOfService: "https://legibility.io/terms",
              provider: { "@id": "https://legibility.io/#org" },
            },
          ],
        }),
      },
      {
        // PostHog product analytics. Shared project; the product super-property
        // separates ventures. Publishable client key (safe in page markup).
        children:
          "(function(){var s=document.createElement('script');s.async=true;s.src='https://us-assets.i.posthog.com/static/array.js';s.onload=function(){window.posthog.init('phc_uNKPzXzC9QCgkZo2VcTmpwVTNuKtZpghXdeuA5ciBBaz',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only',capture_pageview:true,capture_pageleave:true});window.posthog.register({product:'legibility'});};document.head.appendChild(s);})();",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Favicon set generated by scripts/build-brand-assets.ts from one drawing of the mark.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      // Machine-readable summaries for answer engines and agents.
      { rel: "alternate", type: "text/plain", title: "llms.txt", href: "/llms.txt" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Self-referencing canonical URL for the current route.
 *
 * Previously only the homepage carried a canonical tag, so every other page had none.
 * That matters here because the same content is reachable on more than one hostname
 * (apex, www, and any Vercel deployment alias), and without a canonical each host looks
 * like a separate copy to a crawler. Emitting it from the shell covers every route.
 *
 * Shape matches public/sitemap.xml exactly: "/" keeps its slash, everything else has no
 * trailing slash, so the canonical and the sitemap never disagree.
 */
function useCanonicalHref(): string {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/") return `${APP_ORIGIN}/`;
  return `${APP_ORIGIN}${pathname.replace(/\/+$/, "")}`;
}

function RootShell({ children }: { children: ReactNode }) {
  const canonical = useCanonicalHref();
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js). Google's instructions put it first in <head>, but React 19
            hoists title, meta, link and async scripts ahead of any other head child during
            SSR. So the async loader lands right after charset, viewport and the stylesheets,
            and the inline config lands after the rest of the metadata, still ahead of the
            JSON-LD and PostHog scripts. Rendering it here, before HeadContent, is as early as
            React allows; head().scripts would put the config after the JSON-LD. */}
        <script async src={GA_SCRIPT_SRC} />
        <script dangerouslySetInnerHTML={{ __html: GA_INLINE }} />
        <HeadContent />
        <link rel="canonical" href={canonical} />
      </head>
      <body>
        {/* WCAG 2.4.1 Bypass Blocks. Visually hidden until focused by keyboard. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-background"
        >
          Skip to content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // A2: keep the touch a page load carries (utm tags or an MCP directory), once per load.
  useEffect(() => recordLanding(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
