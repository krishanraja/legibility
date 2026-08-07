// Vercel-targeted TanStack Start config. Lovable toolchain removed (was @lovable.dev/vite-tanstack-config).
// Plugin set per Vercel's TanStack Start guide: https://vercel.com/docs/frameworks/full-stack/tanstack-start
// Vercel auto-detects TanStack Start + Nitro and runs on Fluid Compute; no explicit preset needed.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Regenerate public/sitemap.xml from the real route files on every build, so it can
// never go stale: add a public page route and it appears in the sitemap automatically.
// Derives paths from src/routes/*.tsx (flat routing), excluding api, auth, dynamic,
// and layout-only routes. Runs on buildStart, so it fires however the build is invoked.
function sitemapPlugin(origin: string): Plugin {
  return {
    name: "legibility-sitemap",
    buildStart() {
      const routesDir = resolve(__dirname, "src/routes");
      const files = readdirSync(routesDir).filter((f) => f.endsWith(".tsx"));
      const paths = new Set<string>();
      for (const f of files) {
        const base = f.replace(/\.tsx$/, "");
        // Skip the root layout, private/auth, api, and dynamic ($param) routes.
        if (
          base === "__root" ||
          base.startsWith("_") ||
          base.startsWith("api") ||
          base.includes("$")
        )
          continue;
        let p = "/" + base.split(".").join("/");
        p = p.replace(/\/index$/, ""); // docs.index -> /docs, index -> ""
        if (p === "") p = "/";
        paths.add(p);
      }
      const isLegal = (p: string) => /^\/(privacy|terms|takedown)$/.test(p);
      const priority = (p: string) =>
        p === "/"
          ? "1.0"
          : isLegal(p)
            ? "0.3"
            : p === "/docs" || /^\/docs\/(quickstart|api)/.test(p)
              ? "0.9"
              : p.startsWith("/docs")
                ? "0.7"
                : "0.6";
      const changefreq = (p: string) => (isLegal(p) ? "monthly" : "weekly");

      // lastmod from the route file's real last commit date.
      //
      // Deliberately omitted rather than faked when git is unavailable (shallow clone, no
      // history, git missing). A lastmod that just says "now" on every build is worse than
      // none: crawlers learn to distrust it and then ignore it when it is genuine.
      const lastmodFor = (p: string): string | null => {
        const base = p === "/" ? "index" : p.slice(1).split("/").join(".");
        for (const candidate of [`src/routes/${base}.tsx`, `src/routes/${base}.index.tsx`]) {
          try {
            const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", candidate], {
              cwd: __dirname,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
            }).trim();
            if (iso) return iso.slice(0, 10);
          } catch {
            /* git unavailable or path unknown; fall through and omit */
          }
        }
        return null;
      };

      const urls = [...paths].sort();
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls
          .map((p) => {
            const lastmod = lastmodFor(p);
            return (
              `  <url><loc>${origin}${p}</loc>` +
              (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
              `<changefreq>${changefreq(p)}</changefreq>` +
              `<priority>${priority(p)}</priority></url>`
            );
          })
          .join("\n") +
        "\n</urlset>\n";
      writeFileSync(resolve(__dirname, "public/sitemap.xml"), xml);
    },
  };
}

export default defineConfig({
  plugins: [
    // @ -> src alias from tsconfig; must resolve before the framework plugins.
    tsConfigPaths(),
    // Route TanStack Start's server entry through src/server.ts (our SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
    tailwindcss(),
    sitemapPlugin("https://legibility.io"),
  ],
});
