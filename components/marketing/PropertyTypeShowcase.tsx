"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/marketing/icons";
import {
  getShowcaseSolutions,
  getSolution,
  ACCENT_TEXT,
  ACCENT_BG,
  ACCENT_GLOW,
  type Solution,
  type PropertyAccent,
} from "@/lib/solutions";
import { track } from "@/lib/marketing/track-client";

/**
 * Property Type Showcase — the "One platform, every kind of property" module.
 *
 * A single premium module that pairs a property-type selector with a featured
 * property panel so the two read as ONE connected, interactive experience:
 *
 *   DESKTOP (lg+)
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  II  Hotels                ▓───────────┐                 │
 *   │       City & business                 │                 │
 *   │  II  Hotel Groups        <accent      │  PROPERTY IMAGE  │
 *   │  II  Hostels              connector>  │  + preview pill  │
 *   │  ▣  Vacation Rentals  →               │  ───────────────  │
 *   │       Villas & homes                  │  title / value   │
 *   │  II  Boutique Hotels                  │  capabilities    │
 *   │  II  Resorts                          │  CTAs            │
 *   │  II  Bed & Breakfasts                 └──────────────────┘
 *   └───────────────────────────────────────────────────────────┘
 *
 *   MOBILE / TABLET — compact horizontally-scrolling chips above the panel.
 *
 * The selector tiles fill the panel height (no wasted left column). The active
 * tile carries a brand accent rail + arrow + glow; a short accent connector
 * links it to the featured panel, which echoes the same accent in its top bar,
 * overlay pill and CTA. Switching types crossfades the image (fade + slight
 * scale) while the content fades/slides on an independent stagger.
 *
 * Reduced-motion safe, keyboard navigable (arrows on desktop), analytics fire
 * on view / select / CTA. All on-image labels are clearly a HospiOS preview.
 */

const SOLUTIONS = getShowcaseSolutions();
const DEFAULT = SOLUTIONS[0];

const CROSSFADE_MS = 550;

/** Short, truthful descriptor per showcased type (shown as tile micro-meta). */
const SHORT_LABEL: Record<string, string> = {
  hotels: "Full-service",
  groups: "Portfolios",
  hostels: "Beds & dorms",
  "vacation-rentals": "Villas & homes",
  "boutique-hotels": "Design-led",
  resorts: "Resorts",
  "bed-and-breakfast": "Owner-run",
  "serviced-apartments": "Corporate stays",
};

const ARROW = (
  <svg
    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M3 10a.75.75 0 0 1 .75-.75h10.94l-4.72-4.72a.75.75 0 1 1 1.06-1.06l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06l4.72-4.72H3.75A.75.75 0 0 1 3 10Z"
      clipRule="evenodd"
    />
  </svg>
);

export default function PropertyTypeShowcase() {
  const [active, setActive] = useState<Solution>(DEFAULT);
  const [prev, setPrev] = useState<Solution | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onMq);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    track("property_type_view", DEFAULT.slug);
    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const select = (next: Solution) => {
    if (next.slug === active.slug) return;
    setPrev(active);
    setActive(next);
    track("property_type_select", next.slug);
  };

  // Keep the previous image mounted only briefly to crossfade.
  useEffect(() => {
    if (!prev) return;
    const t = setTimeout(() => setPrev(null), CROSSFADE_MS + 80);
    return () => clearTimeout(t);
  }, [prev]);

  // Keyboard: arrow navigation on the desktop (vertical) selector.
  const onNavKeyDown = (e: React.KeyboardEvent) => {
    const isVertical = window.matchMedia("(min-width: 1024px)").matches;
    if (!isVertical) return;
    const key = e.key;
    if (key !== "ArrowDown" && key !== "ArrowUp") return;
    e.preventDefault();
    const idx = SOLUTIONS.findIndex((s) => s.slug === active.slug);
    const dir = key === "ArrowDown" ? 1 : -1;
    const next = SOLUTIONS[(idx + dir + SOLUTIONS.length) % SOLUTIONS.length];
    select(next);
    // Move focus onto the newly-selected button without a full re-render jump.
    requestAnimationFrame(() => {
      navRef.current
        ?.querySelector<HTMLButtonElement>(`button[data-slug="${next.slug}"]`)
        ?.focus();
    });
  };

  const drift = reducedMotion ? 0 : Math.min(scrolled * -0.004, -6);

  return (
    <div className="relative">
      {/* ── One integrated module ── */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
        <div className="grid gap-px lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
          {/* ── Selector (left) ── */}
          <nav
            ref={navRef}
            aria-label="Property types"
            onKeyDown={onNavKeyDown}
            className="scroll-smooth flex gap-2 overflow-x-auto border-b border-zinc-800 p-3 sm:gap-3 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]"
          >
            {SOLUTIONS.map((s, i) => {
              const selected = s.slug === active.slug;
              const accentText = ACCENT_TEXT[s.accent];
              const accentBg = ACCENT_BG[s.accent];
              return (
                <button
                  key={s.slug}
                  data-slug={s.slug}
                  type="button"
                  aria-pressed={selected}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => select(s)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`group animate-fade-up relative flex flex-none shrink-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:px-4 lg:flex-1 lg:shrink ${
                    selected
                      ? `${ACCENT_BORDER[s.accent]} bg-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_28px_-14px_rgba(0,0,0,0.6)]`
                      : "border-zinc-700 bg-zinc-800 hover:border-zinc-500 hover:bg-zinc-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_20px_-12px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  {/* Active accent rail (left edge) — slides & indicates selection
                      without relying on color alone (also shown via border/text/icon/arrow). */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200 ${
                      selected
                        ? `scale-y-100 ${ACCENT_RAIL[s.accent]} opacity-100`
                        : "scale-y-0 opacity-0"
                    }`}
                  />

                  {/* Icon chip */}
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                      selected
                        ? `${ACCENT_BG[s.accent]} ${accentText} ${ACCENT_BORDER[s.accent]} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`
                        : "border-zinc-700 bg-zinc-700/60 text-zinc-200 group-hover:border-zinc-500 group-hover:bg-zinc-600 group-hover:text-zinc-50"
                    }`}
                  >
                    <Icon name={s.icon} className="h-5 w-5" />
                  </span>

                  {/* Label + micro-meta */}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold leading-tight ${
                        selected ? "text-zinc-50" : "text-zinc-200 group-hover:text-zinc-50"
                      }`}
                    >
                      {s.name}
                    </span>
                    <span
                      className={selected ? "mt-0.5 block truncate text-xs text-zinc-400" : "mt-0.5 hidden truncate text-xs text-zinc-500 group-hover:text-zinc-400 sm:block lg:block"}
                    >
                      {SHORT_LABEL[s.slug] ?? s.audience}
                    </span>
                  </span>

                  {/* Arrow / active indicator */}
                  <span
                    aria-hidden="true"
                    className={`ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                      selected
                        ? `${accentBg} ${accentText} translate-x-0 opacity-100`
                        : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    }`}
                  >
                    {ARROW}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* ── Featured panel + accent connector (right) ── */}
          <div className="relative grid min-w-0 grid-cols-1 content-start lg:items-stretch">
            {/* Accent connector: from active selector down into the panel (desktop). */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute -left-px top-0 hidden w-[3px] rounded-b-full transition-all duration-300 lg:block ${ACCENT_RAIL[active.accent]} ${
                reducedMotion ? "" : ""
              }`}
              style={{ height: "56px" }}
            />

            {/* Featured panel */}
            <div className={`group relative overflow-hidden rounded-none lg:rounded-none`}>
              {/* image crossfade layers */}
              <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/9] lg:aspect-[16/9]">
                {prev && (
                  <FadeImage
                    key={`prev-${prev.slug}`}
                    sol={prev}
                    active={false}
                    reveal={false}
                  />
                )}
                <FadeImage
                  key={`active-${active.slug}`}
                  sol={active}
                  active
                  reveal={reducedMotion ? false : true}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/25 to-zinc-950/20"
                />

                {/* HOSPIOS preview overlay — illustrative, not live metrics */}
                <div className="absolute right-4 top-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur ${
                      ACCENT_TEXT[active.accent]
                    } ${ACCENT_BG[active.accent]} border-zinc-700/70`}
                  >
                    <Icon name="dashboard" className="h-3 w-3" />
                    HospiOS preview
                  </span>
                </div>

                {/* Accent echo — top hairline tying image to selected type */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-[3px] ${ACCENT_RAIL[active.accent]}`}
                />
              </div>

              {/* content */}
              <div className="relative p-6 sm:p-8">
                <div key={active.slug} className="content-swap animate-content">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${ACCENT_BG[active.accent]} ${ACCENT_TEXT[active.accent]} ${ACCENT_BORDER[active.accent]}`}
                    >
                      <Icon name={active.icon} className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                        {active.name}
                      </h3>
                      <p className="text-sm text-zinc-400">{active.audience}</p>
                    </div>
                  </div>

                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300">
                    {active.value}
                  </p>

                  <ul className="mt-5 flex flex-wrap gap-2">
                    {active.capabilities.map((c) => (
                      <li
                        key={c}
                        className="pill-in rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1 text-xs font-medium text-zinc-300"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/solutions/${active.slug}`}
                      onClick={() => track("property_type_solution_click", active.slug)}
                      className={`btn-shine group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400`}
                      style={{ background: ACCENT_CTA[active.accent] }}
                    >
                      {active.cta}
                      <svg
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 10a.75.75 0 0 1 .75-.75h10.94l-4.72-4.72a.75.75 0 1 1 1.06-1.06l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06l4.72-4.72H3.75A.75.75 0 0 1 3 10Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Link>
                    <Link
                      href="/score-check"
                      onClick={() => track("property_type_score_click", active.slug)}
                      className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:border-indigo-400 hover:text-indigo-300 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                    >
                      <Icon name="star" className="h-4 w-4 text-amber-400" />
                      Check how your {shortLabel(active.slug)} performs
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!reducedMotion && (
          <div
            aria-hidden="true"
            style={{
              transform: drift ? `translateY(${drift}px)` : undefined,
            }}
            className={`pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-gradient-to-br ${ACCENT_GLOW[active.accent]} from-transparent to-transparent blur-3xl`}
          />
        )}
      </div>
    </div>
  );
}

function FadeImage({
  sol,
  active,
  reveal,
}: {
  sol: Solution;
  active: boolean;
  reveal: boolean;
}) {
  const [errored, setErrored] = useState(false);
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500 ease-out"
      style={{ opacity: active ? 1 : 0 }}
    >
      {errored ? (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${ACCENT_BG[sol.accent]} ${ACCENT_TEXT[sol.accent]}`}
        >
          <div className="text-center">
            <Icon name="building" className="mx-auto h-10 w-10" />
            <p className="mt-2 text-sm font-medium">{sol.name}</p>
          </div>
        </div>
      ) : (
        <Image
          src={sol.image}
          alt={sol.imageAlt}
          fill
          sizes="(min-width: 1024px) 720px, 92vw"
          priority={active}
          loading={active ? undefined : "lazy"}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${
            reveal ? "crossfade-in" : ""
          }`}
        />
      )}
    </div>
  );
}

function shortLabel(slug: string): string {
  const labels: Record<string, string> = {
    hotels: "hotel",
    groups: "portfolio",
    hostels: "hostel",
    "vacation-rentals": "vacation rental",
    "boutique-hotels": "boutique hotel",
    resorts: "resort",
    "bed-and-breakfast": "B&B",
    "serviced-apartments": "serviced apartment",
  };
  return labels[slug] ?? (getSolution(slug)?.name ?? "property");
}

const ACCENT_CTA: Record<string, string> = {
  indigo: "linear-gradient(135deg,#6366f1,#7c3aed)",
  teal: "linear-gradient(135deg,#14b8a6,#0d9488)",
  magenta: "linear-gradient(135deg,#d946ef,#c026d3)",
  orange: "linear-gradient(135deg,#f97316,#ea580c)",
  blue: "linear-gradient(135deg,#0ea5e9,#2563eb)",
  emerald: "linear-gradient(135deg,#10b981,#059669)",
  amber: "linear-gradient(135deg,#f59e0b,#d97706)",
  sky: "linear-gradient(135deg,#06b6d4,#0ea5e9)",
};

/** Accent border classes for the active selector tile / icon chip surface. */
const ACCENT_BORDER: Record<PropertyAccent, string> = {
  indigo: "border-indigo-400/70",
  teal: "border-teal-400/70",
  magenta: "border-fuchsia-400/70",
  orange: "border-orange-400/70",
  blue: "border-sky-400/70",
  emerald: "border-emerald-400/70",
  amber: "border-amber-400/70",
  sky: "border-cyan-400/70",
};

/** Solid accent classes for the left active rail and panel top hairline. */
const ACCENT_RAIL: Record<PropertyAccent, string> = {
  indigo: "bg-indigo-400",
  teal: "bg-teal-400",
  magenta: "bg-fuchsia-400",
  orange: "bg-orange-400",
  blue: "bg-sky-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  sky: "bg-cyan-400",
};