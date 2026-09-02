"use client";

import { useEffect, useRef, useState } from "react";
import Marquee from "@/components/marketing/Marquee";
import TrackCta from "@/components/marketing/TrackCta";
import Icon from "@/components/marketing/icons";
import {
  INTEGRATION_CATALOG,
  SUPPORTED_COUNT,
  TOTAL_INTEGRATIONS,
  type IntegrationCategory,
  type IntegrationItem,
} from "@/lib/integrations";
import { track } from "@/lib/marketing/track-client";
import type { IconName } from "@/components/marketing/icons";

/**
 * Homepage "Integration Ecosystem". Upgrades the old text-pill marquee into a
 * premium ecosystem: a HospiOS-central node visual, category filters, a
 * multi-row animated logo marquee, featured cards with truthful hover/tap
 * detail, a trust strip, an API-first statement, and lead CTAs.
 *
 * TRUTHFULNESS: logs are clean wordmarks (no fabricated logos). `supported`
 * items reflect real wired adapters (payments); `available` items are catalogue
 * ecosystem platforms — never shown as "connected". No capabilities are claimed
 * unless they exist in the catalogue.
 */

const FILTERS: { id: IntegrationCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "otas", label: "OTAs" },
  { id: "payments", label: "Payments" },
  { id: "calendar", label: "Calendars" },
  { id: "accounting", label: "Accounting" },
  { id: "comms", label: "Communication" },
  { id: "hardware", label: "Hardware" },
];

/** Multi-row marquee, 3 truthfully-labelled lanes. */
const MARQUEE_ROWS: { id: IntegrationCategory | "comms" | "calendar" | "accounting"; reverse: boolean; speed: number }[] = [
  { id: "otas", reverse: false, speed: 55 },
  { id: "payments", reverse: true, speed: 42 },
  { id: "comms", reverse: false, speed: 50 },
];

function Wordmark({ item }: { item: IntegrationItem }) {
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight ${item.accent}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${item.accent} bg-current opacity-60`}
      />
      {item.name}
    </span>
  );
}

function TrustCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

export default function EcosystemShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<IntegrationCategory | "all">("all");
  const [open, setOpen] = useState<IntegrationItem | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const done = () => {
      if (!seen) {
        setSeen(true);
        track("integration_section_view");
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          done();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  const marqueeFor = (id: IntegrationCategory) =>
    INTEGRATION_CATALOG.filter((i) => i.category === id).slice(0, 8);

  const featured =
    filter === "all"
      ? [
          ...INTEGRATION_CATALOG.filter((i) => i.status === "supported").slice(0, 4),
          ...["booking", "airbnb", "expedia", "gcal"].map((id) => INTEGRATION_CATALOG.find((i) => i.id === id)!),
        ]
      : INTEGRATION_CATALOG.filter((i) => i.category === filter).slice(0, 8);

  return (
    <div ref={sectionRef} id="ecosystem" className="relative">
      {/* ───────── hospiOS-central ecosystem node visual ───────── */}
      <div className="relative mx-auto mb-10 flex max-w-3xl items-center justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-2xl"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-900/80 to-zinc-950 shadow-2xl shadow-indigo-500/20 sm:h-28 sm:w-28">
          <Icon name="network" className="h-9 w-9 text-indigo-300 sm:h-11 sm:w-11" />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl ring-1 ring-indigo-400/30 animate-glow"
          />
        </div>
        <div className="absolute left-1/2 top-[calc(50%+4.5rem)] -translate-x-1/2 text-center sm:top-[calc(50%+5.5rem)]">
          <p className="text-sm font-bold tracking-[0.25em] text-zinc-100">HOSPIOS</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Hospitality Operating System
          </p>
        </div>
      </div>
      <p className="mt-2 text-center text-sm font-medium text-zinc-400">
        One platform. Everything connected.
      </p>

      {/* ───────── category filter ───────── */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter integrations by category">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(f.id);
                setOpen(null);
                track("integration_category_select", f.id);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ───────── featured integrations (filtered) ───────── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {featured.map((item) => {
          const isOpen = open?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(isOpen ? null : item);
                track("integration_logo_click", item.id);
              }}
              onMouseEnter={() => track("integration_logo_hover", item.id)}
              className={`group flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
                isOpen
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600 hover:bg-zinc-900/60"
              }`}
            >
              <span className="flex w-full items-center justify-between">
                <span className={`text-sm font-bold ${item.accent}`}>{item.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    item.status === "supported"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-zinc-700/50 text-zinc-400"
                  }`}
                >
                  {item.status === "supported" ? "Supported" : "Available"}
                </span>
              </span>
              <span className="text-xs text-zinc-500">{item.role}</span>
              {isOpen && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {item.capabilities.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                    >
                      {c}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ───────── multi-row animated marquee ───────── */}
      <div className="mt-10 space-y-4">
        {MARQUEE_ROWS.map((row) => {
          const items = marqueeFor(row.id);
          return (
            <div key={row.id} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {row.id === "payments" ? "Payment gateways" : row.id === "otas" ? "OTAs & distribution" : "Communication"}
              </p>
              <Marquee duration={row.speed} reverse={row.reverse}>
                {items.map((i) => (
                  <span key={i.id} className="mx-4 shrink-0 opacity-70 transition hover:opacity-100">
                    <Wordmark item={i} />
                  </span>
                ))}
              </Marquee>
            </div>
          );
        })}
      </div>

      {/* ───────── trust strip ───────── */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrustCard icon="shield" title="Gateway-secured payments" body={`${SUPPORTED_COUNT} payment gateways wired into one settlement flow.`} />
        <TrustCard icon="globe" title="Cloud-based platform" body="Runs wherever you do — no on-site servers to manage." />
        <TrustCard icon="plug" title="API-first integrations" body="REST API + webhooks so your stack connects to everything else." />
        <TrustCard icon="chat" title="Human support" body="Real people on call when your operations need a hand." />
      </div>

      {/* ───────── API-first statement ───────── */}
      <div className="glow-border mt-10 rounded-3xl border border-indigo-900 bg-indigo-950/30 p-6 sm:p-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-indigo-300">
          Connect anything
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-center text-base text-zinc-300 sm:text-lg">
          APIs, webhooks and integrations built for your stack — extend HospiOS,
          or mesh it with the tools you already rely on.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />HospiOS API</span>
          <span aria-hidden="true" className="text-zinc-600">→</span>
          <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />Webhooks</span>
          <span aria-hidden="true" className="text-zinc-600">→</span>
          <span>OTA · Payments · CRM · Accounting · Hardware</span>
        </div>
      </div>

      {/* ───────── lead CTAs ───────── */}
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <TrackCta
          href="/integrations"
          event="integration_request_click"
          className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Request an integration
          <Icon name="megaphone" className="h-4 w-4" />
        </TrackCta>
        <TrackCta
          href="/demo"
          event="integration_demo_click"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
        >
          Book a demo
          <Icon name="trend" className="h-4 w-4" />
        </TrackCta>
      </div>
      <p className="mt-4 text-center text-sm text-zinc-500">
        Bring your existing stack. HospiOS connects the rest — {TOTAL_INTEGRATIONS}{" "}
        integrations and growing.
      </p>
    </div>
  );
}