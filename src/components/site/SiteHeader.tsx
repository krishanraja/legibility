import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/lib/auth";
import icon from "@/assets/legibility-icon-and-favicon.png";
import wordmark from "@/assets/legibility-wordmark-new.png.png";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false); // P3.2: mobile nav (the front door was missing on mobile)
  const { user } = useAuth();

  const links = (
    <>
      {/*
        "check" first: the free verdict is the primary action of the whole site and was
        reachable only by scrolling the front page. Docs stay, one place further along,
        for the secondary audience llms.txt names.
      */}
      <a href="/#check" className="hover:text-foreground" onClick={() => setMenu(false)}>
        check a site
      </a>
      <Link to="/about/bot" className="hover:text-foreground" onClick={() => setMenu(false)}>
        the bot
      </Link>
      <Link to="/docs" className="hover:text-foreground" onClick={() => setMenu(false)}>
        docs
      </Link>
      <a href="/#pricing" className="hover:text-foreground" onClick={() => setMenu(false)}>
        pricing
      </a>
      <Link to="/docs/mcp" className="hover:text-foreground" onClick={() => setMenu(false)}>
        mcp
      </Link>
      {user ? (
        <Link
          to="/dashboard"
          onClick={() => setMenu(false)}
          className="rounded-sm border border-hairline px-3 py-1.5 text-foreground hover:border-signal hover:text-signal"
        >
          dashboard
        </Link>
      ) : (
        <button
          onClick={() => {
            setMenu(false);
            setOpen(true);
          }}
          className="rounded-sm bg-signal px-3 py-1.5 text-background hover:opacity-90"
        >
          sign in
        </button>
      )}
    </>
  );

  return (
    <header className="border-b border-hairline bg-background/70 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 font-mono text-xs">
        <Link to="/" className="flex items-center gap-3">
          <img src={icon} alt="" aria-hidden className="h-14 w-auto" />
          {/*
            The wordmark box is deliberately smaller than the icon box. The icon is a solid
            tile whose ink fills 97% of its height; the wordmark file is a tight crop whose
            ink fills 78%. Matching the two boxes would render the letterforms taller than
            the mark. At h-10 the wordmark ink lands at ~31px against the icon's 56px, which
            is the usual 55% cap-height-to-mark ratio for a horizontal lockup.
          */}
          <img src={wordmark} alt="legibility" className="h-10 w-auto" />
          {/*
            Was "product data for agents", which sold the old product to the old buyer on
            every page including the one arguing the new position. The front page is written
            for a commercial owner of a catalogue; the chrome around it should not contradict
            it in the top left corner.
          */}
          <span className="text-muted-foreground hidden sm:inline">machine readability</span>
        </Link>
        <nav className="hidden items-center gap-7 text-muted-foreground md:flex">{links}</nav>
        {/* Mobile: a hamburger toggles the same nav so sign-in, docs, pricing and mcp are reachable. */}
        <button
          type="button"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm border border-hairline text-foreground"
        >
          <span aria-hidden className="text-base leading-none">
            {menu ? "✕" : "☰"}
          </span>
        </button>
      </div>
      {menu && (
        <nav className="md:hidden border-t border-hairline bg-background px-6 py-4 font-mono text-sm">
          <div className="flex flex-col gap-4 text-muted-foreground">{links}</div>
        </nav>
      )}
      <AuthModal open={open} onOpenChange={setOpen} />
    </header>
  );
}
