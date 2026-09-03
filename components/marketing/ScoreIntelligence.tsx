"use client";

import { useEffect, useRef, useState } from "react";
import TrackCta from "@/components/marketing/TrackCta";
import CountUp from "@/components/marketing/CountUp";
import { gradeForScore, gradeColor, WEIGHTS } from "@/lib/scoring";
import type { ScoreComponent } from "@/lib/types";
import { track } from "@/lib/marketing/track-client";

/**
 * Homepage "Property Score / Intelligence" marketing section.
 *
 * This is a STATIC marketing demo — there is no selected property here, so the
 * panel shows an explicitly-labelled ILLUSTRATIVE example (80 / Good) built on
 * the REAL canonical scoring semantics (WEIGHTS, gradeForScore, 13 signals).
 * Every CTA routes into the real score-check funnel. Nothing here is presented
 * as live customer data: benchmarks & history are gated behind the funnel and
 * the panel is flagged as an example.
 */

const DEMO_SCORE = 80;

/** Sample per-signal values (0..100) that sum plausibly to 80. Illustrative only. */
const DEMO_COMPONENTS: ScoreComponent[] = [
  { key: "ratingQuality", label: "Rating quality", score: 82, weight: WEIGHTS.ratingQuality, detail: "~4.6/5 weighted average across 6 platforms", sourced: true },
  { key: "reviewVolume", label: "Review volume", score: 92, weight: WEIGHTS.reviewVolume, detail: "1,240 total reviews (illustrative)", sourced: true },
  { key: "reviewVelocity", label: "Review velocity", score: 78, weight: WEIGHTS.reviewVelocity, detail: "48 new in the last 30 days", sourced: true },
  { key: "responseRate", label: "Response rate", score: 71, weight: WEIGHTS.responseRate, detail: "71% of reviews responded to", sourced: true },
  { key: "platformDiversity", label: "Platform spread", score: 83, weight: WEIGHTS.platformDiversity, detail: "6 of 10 platforms active", sourced: true },
  { key: "guestExperience", label: "Guest experience", score: 76, weight: WEIGHTS.guestExperience, detail: "Service 80 · Cleanliness 78 · Value 74 · Location 77 · Facilities 71", sourced: true },
  { key: "presence", label: "Online presence", score: 88, weight: WEIGHTS.presence, detail: "Complete profile · website 88/100 · social 64/100", sourced: true },
  { key: "amenities", label: "Amenities & facilities", score: 79, weight: WEIGHTS.amenities, detail: "Coverage of wifi, parking, dining, pool, gym", sourced: true },
  { key: "visualContent", label: "Photos & media", score: 84, weight: WEIGHTS.visualContent, detail: "Volume & quality of photos across channels", sourced: true },
  { key: "sustainability", label: "Sustainability", score: 66, weight: WEIGHTS.sustainability, detail: "Eco practices & credentials", sourced: true },
  { key: "accessibility", label: "Accessibility", score: 58, weight: WEIGHTS.accessibility, detail: "Accessibility for guests with disabilities", sourced: true },
  { key: "directBookings", label: "Direct bookings", score: 73, weight: WEIGHTS.directBookings, detail: "Share of bookings made directly", sourced: true },
  { key: "brandTrust", label: "Class & recognition", score: 81, weight: WEIGHTS.brandTrust, detail: "Star consistency 80/100 · 2 awards", sourced: true },
];

const PROOF_POINTS = [
  "13 hospitality-weighted signals, not guesswork",
  "Missing data never unfairly penalizes your score",
  "Track your score improving over time",
];

const DEMO_SPARKLINE = [72, 74, 77, 80];

function signalColor(score: number): string {
  return score >= 85 ? "#2563eb" : score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#dc2626";
}

/** Accessible summary of the gauge, for screen readers. */
function scoreAriaLabel(score: number): string {
  const grade = gradeForScore(score);
  return `Property score ${score} out of 100, ${grade.toLowerCase()}. This is an illustrative example — run a real scan to see your property's score.`;
}

function Ring({
  score,
  activeKey,
  onPulse,
}: {
  score: number;
  activeKey: string | null;
  onPulse: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(0);
  const size = 220;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const grade = gradeForScore(score);
  const color = gradeColor(grade);

useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let cancelled = false;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDrawn(score);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1100;
        raf = requestAnimationFrame(function tick(now) {
          if (cancelled) return;
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDrawn(score * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [score]);

  return (
    <div className="relative mx-auto" style={{ width: "min(260px, 72vw)" }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full -rotate-90"
        role="img"
        aria-label={scoreAriaLabel(score)}
      >
        <defs>
          <linearGradient id="scoreRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-zinc-800"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scoreRingGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="drop-shadow-[0_0_18px_rgba(99,102,241,0.35)]"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (drawn / 100) * circumference}
          style={{ transition: activeKey ? "stroke-dashoffset 400ms ease" : "none" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          onMouseEnter={onPulse}
          className="flex items-baseline gap-1 text-zinc-50"
        >
          <CountUp to={score} duration={1100} />
          <span className="text-lg font-semibold text-zinc-400">/100</span>
        </div>
        <span
          className="mt-1 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          {grade}
        </span>
        <span className="mt-1 text-center text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          Digital presence
        </span>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 120;
  const h = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-auto"
      role="img"
      aria-label="Illustrative score trend over time"
    >
      <path d={d} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill="#34d399" />
      ))}
    </svg>
  );
}

export default function ScoreIntelligence() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sectionSeen, setSectionSeen] = useState(false);

  // Track section view once.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const done = () => {
      if (!sectionSeen) {
        setSectionSeen(true);
        track("score_section_view");
      }
    };
    if (reduce) {
      done();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          done();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sectionSeen]);

  const worst = [...DEMO_COMPONENTS].sort((a, b) => a.score - b.score)[0];
  const sorted = [...DEMO_COMPONENTS].sort((a, b) => a.score - b.score);
  const summary =
    "Every signal is labelled verified or not yet verified — we never invent data that isn't available.";

  return (
    <div ref={sectionRef} className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      {/* ───────────── Left: copy + proof points + CTAs ───────────── */}
      <div className="order-2 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
          One score
        </p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          See how strong your property&apos;s digital presence really is.
        </h3>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          One intelligent score built from the signals guests and search engines
          actually see — ratings, reviews, listings, website, social and more.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {PROOF_POINTS.map((b) => (
            <li
              key={b}
              className="flex items-center gap-2 text-sm text-zinc-300"
            >
              <svg
                className="h-4 w-4 shrink-0 text-emerald-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                  clipRule="evenodd"
                />
              </svg>
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <TrackCta
            href="/score-check"
            event="score_cta"
            meta="intelligence-primary"
            className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Check your property score
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.6L10.6 5.4a.75.75 0 1 1 1.06-1.06l4.97 4.97a.75.75 0 0 1 0 1.06l-4.97 4.97a.75.75 0 0 1-1.06-1.06l3.75-3.75H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </TrackCta>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* ───────────── Right: interactive intelligence panel ───────────── */}
      <div className="order-1 lg:order-2">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900/60 p-6 shadow-2xl shadow-indigo-500/10 sm:p-8">
          {/* atmospheric background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]"
          />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Property intelligence
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                Illustrative example
              </span>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <Ring
                score={DEMO_SCORE}
                activeKey={openKey}
                onPulse={() => {
                  if (!openKey) track("score_category_hover", "gauge");
                }}
              />

              {/* category + opportunity column */}
              <div className="space-y-4">
                <section aria-label="Score breakdown">
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    13 weighted signals
                  </h4>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {sorted.map((c) => {
                      const color = signalColor(c.score);
                      const open = openKey === c.key;
                      return (
                        <div
                          key={c.key}
                          className="group rounded-lg"
                          onMouseEnter={() => {
                            if (!open) track("score_category_hover", c.key);
                          }}
                        >
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => {
                              const next = open ? null : c.key;
                              setOpenKey(next);
                              track("score_category_open", c.key);
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/5"
                          >
                            <span className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                              <span className="inline-flex h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                              {c.label}
                              <span className="text-[9px] font-semibold uppercase text-zinc-500">
                                {(c.weight * 100).toFixed(0)}%
                              </span>
                            </span>
                            <span className="tabular-nums text-xs font-semibold text-zinc-100">
                              {c.score}
                            </span>
                          </button>
                          {open && (
                            <p className="mx-1 mt-0.5 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-400">
                              {c.detail}
                              {!c.sourced ? " — not yet verified" : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* biggest opportunity — derived from weakest signal, illustrative */}
                <section
                  aria-label="Biggest opportunity"
                  className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                    Biggest opportunity
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">
                    {worst.label}: {worst.score}/100
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {worst.label} is dragging the score down. See exactly how to
                    fix it in your free report.
                  </p>
                </section>
              </div>
            </div>

            {/* provenance + trend + CTA */}
            <div className="mt-6 grid gap-4 border-t border-zinc-800 pt-5 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Data sources
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Google", "Website", "Reviews", "Social", "OTAs"].map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                  {summary}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    Track over time
                  </p>
                  <Sparkline points={DEMO_SPARKLINE} />
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Market benchmarking and score history appear{" "}
                  <span className="font-semibold text-zinc-200">after your scan</span>{" "}
                  — run your own property to see its real trend.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <TrackCta
                href="/score-check"
                event="score_report_click"
                meta="intelligence-panel"
                className="btn-shine inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Get my free property report
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.6L10.6 5.4a.75.75 0 1 1 1.06-1.06l4.97 4.97a.75.75 0 0 1 0 1.06l-4.97 4.97a.75.75 0 0 1-1.06-1.06l3.75-3.75H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </TrackCta>
              <TrackCta
                href="/score-check"
                event="score_demo_click"
                meta="run-my-scan"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
              >
                Run my own scan
              </TrackCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}