"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: IconName;
}

const PLATFORM_ITEMS: NavItem[] = [
  { label: "Booking Engine", href: "/platform/bookingengine", description: "Branded, mobile-first direct bookings", icon: "globe" },
  { label: "PMS — Front Desk", href: "/platform/frontdesk", description: "Rooms, guests & daily operations", icon: "frontdesk" },
  { label: "Channel Manager", href: "/platform/channel", description: "Two-way sync across 14+ OTAs", icon: "network" },
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
  { label: "Case studies", href: "/case-studies", description: "Operator journeys, illustrated" },
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
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="group relative"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
      }}
    >
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-50"
        aria-haspopup="true"
        aria-expanded={expanded}
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

function MobileAccordion({
  id,
  title,
  count,
  items,
  showIcons,
  active,
  onToggle,
  enterDelay,
  linkDelayBase,
  onNavigate,
}: {
  id: string;
  title: string;
  count: number;
  items: NavItem[];
  showIcons?: boolean;
  active: boolean;
  onToggle: (id: string) => void;
  enterDelay: number;
  linkDelayBase: number;
  onNavigate: () => void;
}) {
  return (
    <div
      className="mobile-accordion-enter overflow-hidden rounded-xl"
      style={{ animationDelay: `${enterDelay}ms` }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={active}
        aria-controls={`mob-${id}`}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-zinc-900/80 active:bg-zinc-900"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          <span className="rounded-full border border-zinc-700/60 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {count}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              active ? "bg-emerald-400" : "bg-zinc-700"
            }`}
          />
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${
              active ? "rotate-180 text-indigo-300" : ""
            }`}
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
        </span>
      </button>
      <div
        id={`mob-${id}`}
        role="region"
        aria-label={title}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pb-2 pr-2 pt-1">
            {items.map((item, idx) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                className="link-pop group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50 active:scale-[0.98]"
                style={
                  active
                    ? { animationDelay: `${linkDelayBase + idx * 22}ms` }
                    : undefined
                }
              >
                {showIcons && item.icon && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300 transition group-hover:bg-indigo-500/20 group-hover:text-indigo-200">
                    <Icon name={item.icon} className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate">{item.label}</span>
                <svg
                  className="ml-auto h-3.5 w-3.5 -translate-x-1 text-zinc-600 opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("platform");
  const closeTimer = useRef<number | undefined>(undefined);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const closeMenu = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 180);
  };

  useFocusTrap(menuRef, open, {
    onEscape: closeMenu,
    initialFocusRef: hamburgerRef,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on any route change.
  useEffect(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(false);
    setClosing(false);
  }, [pathname]);

  // While the mobile menu is open, lock page scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
            aria-current={pathname === "/pricing" ? "page" : undefined}
            className="link-underline rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-50"
          >
            Pricing
          </Link>
          <Dropdown label="Resources" items={RESOURCE_ITEMS} wide />
          <Link
            href="/score-check"
            aria-current={pathname === "/score-check" ? "page" : undefined}
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
            className="btn-shine inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            Book a demo
          </Link>
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => {
              if (open) {
                closeMenu();
              } else {
                setActiveSection("platform");
                setOpen(true);
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-300 transition active:scale-95 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {(open || closing) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id="mobile-menu"
            role="dialog"
            aria-label="Mobile navigation"
            className={`fixed inset-x-0 bottom-0 top-16 z-[65] overflow-y-auto overscroll-contain border-t border-zinc-800 bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950 px-4 pb-10 pt-2 lg:hidden ${
              closing ? "mobile-menu-exit" : "mobile-menu-enter"
            }`}
          >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            <p className="mobile-accordion-enter mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500" style={{ animationDelay: "40ms" }}>
              Explore HospiOS
            </p>
            <MobileAccordion
              id="platform"
              title="Platform"
              count={PLATFORM_ITEMS.length}
              items={PLATFORM_ITEMS}
              showIcons
              active={activeSection === "platform"}
              onToggle={() => setActiveSection((v) => (v === "platform" ? null : "platform"))}
              enterDelay={70}
              linkDelayBase={60}
              onNavigate={closeMenu}
            />
            <MobileAccordion
              id="solutions"
              title="Solutions"
              count={SOLUTION_ITEMS.length}
              items={SOLUTION_ITEMS}
              active={activeSection === "solutions"}
              onToggle={() => setActiveSection((v) => (v === "solutions" ? null : "solutions"))}
              enterDelay={130}
              linkDelayBase={60}
              onNavigate={closeMenu}
            />
            <MobileAccordion
              id="resources"
              title="Resources"
              count={RESOURCE_ITEMS.length}
              items={RESOURCE_ITEMS}
              active={activeSection === "resources"}
              onToggle={() => setActiveSection((v) => (v === "resources" ? null : "resources"))}
              enterDelay={190}
              linkDelayBase={60}
              onNavigate={closeMenu}
            />
            <div className="flex flex-col gap-1 pt-2">
              <Link
                href="/pricing"
                onClick={closeMenu}
                className="mobile-accordion-enter link-pop flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 active:scale-[0.98]"
                style={{ animationDelay: "250ms" }}
              >
                Pricing
                <span className="ml-auto rounded-full border border-zinc-700/60 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  3 plans
                </span>
              </Link>
              <Link
                href="/score-check"
                onClick={closeMenu}
                className="mobile-accordion-enter link-pop flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10 active:scale-[0.98]"
                style={{ animationDelay: "310ms" }}
              >
                Score check
                <span className="ml-auto rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  Free
                </span>
              </Link>
              <Link
                href="/account"
                onClick={closeMenu}
                className="mobile-accordion-enter link-pop flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-300 transition hover:bg-zinc-900 active:scale-[0.98]"
                style={{ animationDelay: "370ms" }}
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                onClick={closeMenu}
                className="mobile-accordion-enter btn-shine mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 active:scale-[0.98]"
                style={{ animationDelay: "430ms" }}
              >
                Book a demo
              </Link>
            </div>

            <div
              className="mobile-accordion-enter mt-5 space-y-1 border-t border-zinc-800/80 pt-4"
              style={{ animationDelay: "470ms" }}
            >
              <a
                href="mailto:hello@hospios.dev"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <svg className="h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
                hello@hospios.dev
              </a>
              <Link
                href="/contact"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <svg className="h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                </svg>
                Talk to sales &amp; support
              </Link>
              <p className="px-3 pt-1 text-[11px] text-zinc-600">
                HospiOS · Hospitality OS — support replies within one business day.
              </p>
            </div>
          </nav>
          </div>,
          document.body,
        )}
    </header>
  );
}
