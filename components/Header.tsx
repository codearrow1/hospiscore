"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";

interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: IconName;
}

const PLATFORM_ITEMS: NavItem[] = [
  { label: "Booking Engine", href: "/platform/bookingengine", description: "Branded, mobile-first direct bookings", icon: "globe" },
  { label: "PMS — Front Desk", href: "/platform/frontdesk", description: "Rooms, guests & daily operations", icon: "frontdesk" },
  { label: "Channel Manager", href: "/platform/channel", description: "Two-way sync across 50+ OTAs", icon: "network" },
  { label: "Restaurant POS", href: "/platform/pos", description: "POS, kitchen display & QR ordering", icon: "utensils" },
  { label: "AI Assistant", href: "/platform/ai", description: "Reply drafts, concierge & forecasting", icon: "ai" },
  { label: "All 23 modules", href: "/platform", description: "Browse the full platform", icon: "dashboard" },
];

const SOLUTION_ITEMS: NavItem[] = [
  { label: "Hotels", href: "/solutions/hotels", description: "Full-service hotels & resorts" },
  { label: "Hotel Groups", href: "/solutions/groups", description: "Multi-property portfolios" },
  { label: "Hostels", href: "/solutions/hostels", description: "Bed-level inventory & groups" },
  { label: "Vacation Rentals", href: "/solutions/vacation-rentals", description: "Villas, cabins & holiday homes" },
  { label: "Boutique Hotels", href: "/solutions/boutique-hotels", description: "Design-led, personal service" },
  { label: "Serviced Apartments", href: "/solutions/serviced-apartments", description: "Long stays, no front desk" },
  { label: "B&Bs & Guesthouses", href: "/solutions/bed-and-breakfast", description: "A few rooms, effortless" },
  { label: "All 10 solutions", href: "/solutions", description: "Browse every property type" },
];

const RESOURCE_ITEMS: NavItem[] = [
  { label: "Free presence score", href: "/free-score", description: "Check any property's online visibility" },
  { label: "Pricing", href: "/pricing", description: "Per-room plans & live calculator" },
  { label: "Case studies", href: "/case-studies", description: "Real properties, real numbers" },
  { label: "Blog", href: "/blog", description: "Hotel operations & revenue insights" },
  { label: "Knowledge base", href: "/knowledge-base", description: "Setup & running guides" },
  { label: "Product updates", href: "/product-updates", description: "Every feature we ship" },
  { label: "Migrate to HospiOS", href: "/migration", description: "Switch from any PMS in a day" },
  { label: "About us", href: "/about", description: "The team behind HospiOS" },
  { label: "Contact", href: "/contact", description: "Talk to sales or support" },
];

function Dropdown({
  label,
  items,
  wide,
}: {
  label: string;
  items: NavItem[];
  wide?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-50"
        aria-haspopup="true"
      >
        {label}
        <svg
          className="h-3.5 w-3.5 transition group-hover:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full z-30 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 focus-within:visible focus-within:opacity-100">
        <div className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-black/40 ${wide ? "w-80" : "w-64"}`}>
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-zinc-800/70"
            >
              {item.icon && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
              )}
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{item.label}</span>
                {item.description && (
                  <span className="block text-xs text-zinc-500">{item.description}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 border-b transition-all duration-300 ${
        scrolled
          ? "border-zinc-800 bg-zinc-950/90 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition group-hover:bg-indigo-500">
            H
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-zinc-950 bg-emerald-400"
            />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-50">
            HospiOS
          </span>
          <span className="mt-0.5 rounded bg-indigo-950 px-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
            PMS
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 text-sm lg:flex"
        >
          <Dropdown label="Platform" items={PLATFORM_ITEMS} wide />
          <Dropdown label="Solutions" items={SOLUTION_ITEMS} />
          <Link
            href="/pricing"
            className="link-underline rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-50"
          >
            Pricing
          </Link>
          <Dropdown label="Resources" items={RESOURCE_ITEMS} wide />
          <Link
            href="/score-check"
            className="link-underline rounded-lg px-3 py-2 text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
          >
            Score check
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="link-underline hidden text-sm text-zinc-400 transition hover:text-zinc-50 sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="btn-shine inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            Book a demo
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-300 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 pb-6 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            <p className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Platform
            </p>
            {PLATFORM_ITEMS.map((i) => (
              <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                {i.label}
              </Link>
            ))}
            <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Solutions
            </p>
            {SOLUTION_ITEMS.map((i) => (
              <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                {i.label}
              </Link>
            ))}
            <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Resources
            </p>
            {RESOURCE_ITEMS.map((i) => (
              <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                {i.label}
              </Link>
            ))}
            <Link href="/pricing" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
              Pricing
            </Link>
            <Link href="/score-check" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-300 hover:bg-zinc-900">
              Score check
            </Link>
            <Link href="/account" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
