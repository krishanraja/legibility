import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

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
      { title: "Legibility · Product data for agents" },
      {
        name: "description",
        content:
          "Typed product object from a URL, a barcode, or a fuzzy name. Confidence per field, cost stamped in the response. REST and MCP, payable by an agent.",
      },
      { property: "og:title", content: "Legibility · Product data for agents" },
      {
        property: "og:description",
        content:
          "Agents can decide what to buy. Reading the product page is where they still break. Legibility reads it for them.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Legibility" },
      { property: "og:url", content: "https://legibility.io" },
      { property: "og:image", content: "https://legibility.io/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Legibility · Product data for agents" },
      { name: "twitter:description", content: "One call turns a URL, a barcode, or a fuzzy name into a typed product object with calibrated confidence and cost stamped in. REST and MCP." },
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
                "Typed product data for AI agents. A product URL, barcode, or fuzzy name to a typed object with calibrated per-field confidence, a price band, and the per-call cost stamped in.",
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
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web (REST API and MCP server)",
              url: "https://legibility.io",
              description:
                "Turns a product URL, a barcode, or a fuzzy name into a typed product object an agent can trust: calibrated per-field confidence, a price band, a stable id, and the per-call cost stamped in. REST and MCP, payable by key or per call over x402.",
              offers: [
                { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", description: "1,000 trusted reads per month, no card" },
                { "@type": "Offer", name: "Starter", price: "29", priceCurrency: "USD", description: "5,000 trusted reads per month" },
                { "@type": "Offer", name: "Growth", price: "199", priceCurrency: "USD", description: "50,000 trusted reads per month" },
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

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
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
