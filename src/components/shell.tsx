"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { OFFICIAL_LINKS } from "@/lib/chain/config";
import { APP_NAME, TAGLINE } from "@/lib/version";
import { cn } from "@/lib/utils/cn";
import { MezoMark } from "@/components/mezo-mark";
import { Button } from "@/components/ui";
import { WalletControls } from "@/components/wallet";

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/create", label: "Create", icon: "plus" },
  { href: "/agents", label: "Agents", icon: "spark" },
  { href: "/activity", label: "Activity", icon: "pulse" },
] as const;

const GUIDE_LINKS = [
  { href: "/how-it-works", label: "How it works", icon: "path" },
  { href: "/docs", label: "Docs", icon: "doc" },
] as const;

const MOBILE_LINKS = [
  { href: "/dashboard", label: "Home", icon: "grid" },
  { href: "/create", label: "Create", icon: "plus" },
  { href: "/agents", label: "Agents", icon: "spark" },
  { href: "/activity", label: "Activity", icon: "pulse" },
  { href: "/settings", label: "Settings", icon: "gear" },
] as const;

function NavIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true as const };
  if (name === "grid") {
    return <svg {...common}><rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" /><rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" /><rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" /><rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" /></svg>;
  }
  if (name === "plus") {
    return <svg {...common}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  }
  if (name === "spark") {
    return <svg {...common}><path d="M8 2.5 9.2 6.2 13 7.2 9.2 8.4 8 12.2 6.8 8.4 3 7.2 6.8 6.2 8 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
  }
  if (name === "pulse") {
    return <svg {...common}><path d="M1.5 8h3l1.5-3 2.2 6 1.6-3H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === "path") {
    return <svg {...common}><circle cx="4" cy="4" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><path d="M5.2 5.2 10.8 10.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  }
  if (name === "gear") {
    return <svg {...common}><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4 4l1.1 1.1M10.9 10.9 12 12M12 4l-1.1 1.1M5.1 10.9 4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  return <svg {...common}><path d="M4 2.5h6.2L13 5.2V13.5H4v-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

function DesktopNav({ links, pathname }: { links: readonly { href: string; label: string; icon: string }[]; pathname: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    const root = bar.current;
    const current = root?.querySelector<HTMLElement>("[aria-current='page']");
    if (!root || !current) {
      setMark((value) => ({ ...value, ready: false }));
      return;
    }
    const place = () => {
      const parent = root.getBoundingClientRect();
      const box = current.getBoundingClientRect();
      setMark({ left: box.left - parent.left, width: box.width, ready: true });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pathname, links]);

  return (
    <div ref={bar} className="relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border-2 border-[#163300] bg-[#f3f8ea] p-1">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-[#163300] shadow-[inset_0_-2px_0_#9fe870] transition-[left,width,opacity] duration-300"
        style={{ left: mark.left, width: mark.width, opacity: mark.ready ? 1 : 0 }}
      />
      {links.map((item) => {
        const active = pathname.startsWith(item.href);
        const guideStarts = item.href === "/how-it-works" && links.some((link) => link.href === "/dashboard");
        return (
          <span key={item.href} className="relative z-10 inline-flex items-center">
            {guideStarts ? <span className="mx-1 h-5 w-px bg-[#163300]/25" aria-hidden /> : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                active ? "text-white" : "text-[#163300] hover:bg-white/80",
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <img
        src="/brand/relay-mark.png"
        alt=""
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
        className={compact ? "size-8 rounded-lg" : "size-9 rounded-lg"}
      />
      <span className="display text-lg tracking-[-0.04em]">{APP_NAME}</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const checkout = pathname.startsWith("/checkout");
  const inApp = APP_LINKS.some((item) => pathname.startsWith(item.href)) || pathname.startsWith("/escrows") || pathname.startsWith("/receipt") || pathname.startsWith("/sellers") || pathname.startsWith("/settings");
  const links = inApp ? [...APP_LINKS, ...GUIDE_LINKS] : GUIDE_LINKS;
  const headerRef = useRef<HTMLElement>(null);
  const tabRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const tab = tabRef.current;
    const apply = () => {
      const root = document.documentElement;
      if (header) root.style.setProperty("--app-header", `${header.offsetHeight}px`);
      const tabHeight = tab && getComputedStyle(tab).display !== "none" ? tab.offsetHeight : 0;
      root.style.setProperty("--app-tab", `${tabHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    if (header) observer.observe(header);
    if (tab) observer.observe(tab);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [checkout]);

  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header ref={headerRef} className="sticky top-0 z-40 border-b-2 border-[#163300] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label="RELAY home" className="shrink-0"><Logo /></Link>
          <nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label="Primary">
            {home ? (
              <div className="flex items-center gap-6">
                {GUIDE_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm font-semibold text-[#163300] underline-offset-4 hover:underline hover:decoration-meadow hover:decoration-2">
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <DesktopNav links={links} pathname={pathname} />
            )}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {inApp ? null : <Button href="/dashboard" className="!whitespace-nowrap !border-transparent !bg-meadow !px-4 !text-brand hover:!bg-[#8fdf55]">Launch app</Button>}
            <WalletControls />
          </div>
        </div>
      </header>
      <main id="main" className={cn(home ? "pb-0" : "mx-auto max-w-6xl px-4 py-10", !home && (checkout ? "pb-16" : "pb-28 lg:pb-16"))}>
        {children}
      </main>
      {checkout ? null : (
        <nav ref={tabRef} className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#163300] bg-[#f3f8ea] lg:hidden" aria-label="Mobile">
          <ul className={cn("grid", inApp ? "grid-cols-5" : "grid-cols-3")}>
            {(inApp
              ? MOBILE_LINKS
              : [...GUIDE_LINKS, { href: "/dashboard", label: "Launch", icon: "plus" }]
            ).map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-semibold text-[#163300]/55", active && "text-[#163300]")}>
                    {active ? <span className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-meadow" aria-hidden /> : null}
                    <NavIcon name={item.icon} />
                    {item.label === "How it works" ? "Guide" : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-muted md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo compact />
            <p className="mt-4 max-w-sm text-base text-ink">{TAGLINE}</p>
            <p className="mt-2 max-w-sm">{APP_NAME} has not been independently audited.</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-ink">Product</p>
            <Link className="block hover:text-ink" href="/how-it-works">How it works</Link>
            <Link className="block hover:text-ink" href="/docs">Documentation</Link>
            <Link className="block hover:text-ink" href="/settings">Network status</Link>
            <Link className="block hover:text-ink" href="/create">Create a checkout</Link>
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-ink"><MezoMark className="size-5" />Mezo</p>
            <a className="block hover:text-ink" href={OFFICIAL_LINKS.docs} target="_blank" rel="noopener noreferrer">Developer docs</a>
            <a className="block hover:text-ink" href={OFFICIAL_LINKS.contracts} target="_blank" rel="noopener noreferrer">Contract reference</a>
            <a className="block hover:text-ink" href={OFFICIAL_LINKS.explorer} target="_blank" rel="noopener noreferrer">Testnet explorer</a>
            <a className="block hover:text-ink" href={OFFICIAL_LINKS.faucet} target="_blank" rel="noopener noreferrer">Testnet BTC faucet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
