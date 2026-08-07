import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { APP_ORIGIN } from "@/config/product";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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
      { title: "Legibility · Can a machine read your website?" },
      {
        name: "description",
        content:
          "Legibility measures whether a machine can read a website, and records why when it cannot. Enter a domain and see what an AI crawler sees. Method and sample size published with every figure.",
      },
      { property: "og:title", content: "Legibility · Can a machine read your website?" },
      {
        property: "og:description",
        content:
          "AI assistants recommend products without asking the brand. Enter your domain and see whether one can read yours.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Legibility" },
      { property: "og:url", content: "https://legibility.io" },
      { property: "og:image", content: "https://legibility.io/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Legibility · Can a machine read your website?" },
      {
        name: "twitter:description",
        content:
          "Enter a domain and see what an AI crawler sees. We obey robots.txt, we publish our method, and every figure carries its sample size.",
      },
      { name: "twitter:image", content: "https://legibility.io/og.png" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "application-name", content: "Legibility" },
      { name: "author", content: "Legibility" },
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
              logo: "https://legibility.io/apple-touch-icon.png",
              description:
                "Legibility measures whether a machine can read a website. It publishes which well-known sites an AI crawler cannot read and why, and offers the same reading engine as an API.",
            },
            {
              "@type": "WebSite",
              "@id": "https://legibility.io/#website",
              url: "https://legibility.io",
              name: "Legibility",
              publisher: { "@id": "https://legibility.io/#org" },
            },
            {
              "@type": "SoftwareApplication",
              name: "Legibility",
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
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon.png" },
      { rel: "shortcut icon", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
