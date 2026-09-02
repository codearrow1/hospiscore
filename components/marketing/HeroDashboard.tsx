"use client";

import { useEffect, useRef, useState } from "react";
import UiMock, { type UiMockVariant } from "./UiMock";

/**
 * Hero product stage — the right-hand "one product system" composition.
 *
 * Owns the full dashboard visual: a caption band ("LIVE PRODUCT PREVIEW"),
 * the screen tabs, the UiMock window, and two secondary sample cards. The
 * caption sits in its OWN region above the tabs so it never overlaps screen
 * navigation. Scroll-linked parallax and staggered entrance are subtle,
 * rAF-throttled, and fully disabled under prefers-reduced-motion.
 *
 * All numbers are clearly illustrative (labelled "sample") — nothing implies a
 * real customer's live occupancy.
 */

type PreviewTab = {
  id: string;
  label: string;
  mock: UiMockVariant;
};

const TABS: PreviewTab[] = [
  { id: "dashboard", label: "Live dashboard", mock: "dashboard" },
  { id: "frontdesk", label: "Front desk", mock: "frontdesk" },
  { id: "housekeeping", label: "Housekeeping", mock: "housekeeping" },
  { id: "revenue", label: "Revenue", mock: "revenue" },
];

const OCCUPANCY_BARS = [35, 55, 42, 70, 62, 85, 78];

export default function HeroDashboard() {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onMqChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onMqChange);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const parallax = reducedMotion ? 0 : Math.min(scrolled * 0.03, 20);
  const cardParallax = reducedMotion ? 0 : Math.min(scrolled * -0.045, -12);

  return (
    <div ref={stageRef} className="relative mx-auto w-full max-w-xl">
      {/* Story glow + spinning ring behind the dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-indigo-600/20 via-violet-600/10 to-sky-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 animate-spin-slower rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, rgba(99,102,241,0.35), rgba(56,189,248,0.25), transparent)",
        }}
      />

      {/* Caption band — its OWN region, above the tabs, never overlapping */}
      <div
        role="contentinfo"
        className="animate-fade-up mb-4 flex items-center justify-center gap-2.5 rounded-2xl border border-indigo-800/50 bg-indigo-950/40 px-4 py-2 backdrop-blur"
      >
        <span
          aria-hidden="true"
          className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
          Inside HospiOS
        </p>
        <span aria-hidden="true" className="h-3 w-px bg-indigo-800/70" />
        <p className="text-xs text-indigo-300/80">
          screens your team will use
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Explore HospiOS screens"
        className="animate-fade-up mb-4 flex flex-wrap justify-center gap-2"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-indigo-400 hover:text-indigo-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard — parallax wrapper keeps transform separate from entrance anim */}
      <div
        className="animate-scale-in relative"
        style={{ transform: parallax ? `translateY(${-parallax}px)` : undefined }}
      >
        <div role="tabpanel" className="animate-fade-in" key={active.id}>
          <UiMock variant={active.mock} className="w-full" />
        </div>
      </div>

      {/* Secondary sample cards — clearly subordinate, repositioned so they
          never touch the tabs or headline. Samples, not live data. */}
      <div
        className="pointer-events-none mt-4 flex items-center justify-between gap-3"
        style={{ transform: cardParallax ? `translateY(${cardParallax}px)` : undefined }}
      >
        <div className="animate-fade-up hidden w-44 rounded-2xl border border-zinc-700 bg-zinc-900/95 p-3.5 shadow-xl shadow-black/40 backdrop-blur sm:block">
          <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Tonight&apos;s occupancy
            <span
              aria-hidden="true"
              className="rounded bg-zinc-800 px-1 py-px text-[8px] font-medium normal-case tracking-normal text-zinc-500"
            >
              sample
            </span>
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-50">
            78% <span className="text-xs font-semibold text-emerald-400">▲ +12%</span>
          </p>
          <div className="mt-2 flex h-8 items-end gap-1" aria-hidden="true">
            {OCCUPANCY_BARS.map((h, i) => (
              <div
                key={i}
                className="bar-grow flex-1 rounded-sm bg-indigo-500/70"
                style={{ height: `${h}%`, animationDelay: `${0.15 * i + 0.9}s` }}
              />
            ))}
          </div>
        </div>

        <div className="animate-fade-up hidden items-center gap-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3.5 py-2.5 shadow-lg shadow-black/30 backdrop-blur sm:flex">
          <span aria-hidden="true" className="flex h-2 w-2">
            <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-medium text-zinc-300">
            Live, connected, orchestrated
          </p>
        </div>
      </div>
    </div>
  );
}