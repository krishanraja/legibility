import { Link } from "@tanstack/react-router";
import wordmark from "@/assets/legibility-wordmark-new.png.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline mt-24">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-10 px-6 py-12 font-mono text-xs sm:grid-cols-4">
        <div>
          <img src={wordmark} alt="legibility" className="h-6 w-auto" />
          <p className="mt-3 text-muted-foreground max-w-xs">
            Whether a machine can read a website, and why when it cannot.
          </p>
        </div>
        <div>
          <div className="text-foreground mb-3">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <a href="/#check" className="hover:text-foreground">
                Check a site
              </a>
            </li>
            <li>
              <Link to="/readability" className="hover:text-foreground">
                The index
              </Link>
            </li>
            <li>
              <Link to="/why" className="hover:text-foreground">
                The eight findings
              </Link>
            </li>
            <li>
              <Link to="/docs" className="hover:text-foreground">
                Docs
              </Link>
            </li>
            <li>
              <a href="/#pricing" className="hover:text-foreground">
                Pricing
              </a>
            </li>
            <li>
              <Link to="/docs/mcp" className="hover:text-foreground">
                MCP server
              </Link>
            </li>
            <li>
              <Link to="/docs/errors" className="hover:text-foreground">
                Errors
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-foreground mb-3">Company</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              {/* Was /#thesis, an id that stopped existing when the front page was rewritten. */}
              <a href="/#method" className="hover:text-foreground">
                Method
              </a>
            </li>
            <li>
              <Link to="/about/bot" className="hover:text-foreground">
                Our crawler
              </Link>
            </li>
            <li>
              <a href="/#faq" className="hover:text-foreground">
                FAQ
              </a>
            </li>
            <li>
              <Link to="/takedown" className="hover:text-foreground">
                Takedown
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-foreground mb-3">Legal</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li className="text-muted-foreground/60">v0.1 · pre-release</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
