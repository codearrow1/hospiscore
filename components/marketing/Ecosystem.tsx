"use client";

import { useState } from "react";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { MODULE_CATEGORIES, PMS_MODULES } from "@/lib/modules";

/**
 * Signature "one platform" motif: a central core orbiting seven operating
 * areas. Clicking a category enlarges it and lists its real modules. No
 * fabricated capabilities — every module name comes from lib/modules.ts.
 */

const CATEGORY_STYLE: Record<string, { ring: string; dot: string }> = {
  operations: { ring: "border-indigo-500/40", dot: "bg-indigo-400" },
  guest: { ring: "border-sky-500/40", dot: "bg-sky-400" },
  fnb: { ring: "border-amber-500/40", dot: "bg-amber-400" },
  backoffice: { ring: "border-rose-500/40", dot: "bg-rose-400" },
  finance: { ring: "border-violet-500/40", dot: "bg-violet-400" },
  growth: { ring: "border-emerald-500/40", dot: "bg-emerald-400" },
  enterprise: { ring: "border-fuchsia-500/40", dot: "bg-fuchsia-400" },
};

export default function Ecosystem() {
  const [active, setActive] = useState(MODULE_CATEGORIES[0].id);
  const cat = MODULE_CATEGORIES.find((c) => c.id === active) ?? MODULE_CATEGORIES[0];
  const modules = PMS_MODULES.filter((m) => m.category === cat.id);

  return (
    <div className="grid items-stretch gap-8 lg:grid-cols-[320px_1fr]">
      {/* Central core + orbiting categories */}
      <div className="order-2 flex flex-col justify-center lg:order-1">
        <div className="relative mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="animate-spin-slower absolute inset-4 rounded-full border border-dashed border-indigo-500/25"
          />
          {/* core */}
          <div className="relative z-10 flex h-24 w-24 flex-col items-center justify-center rounded-2xl border border-indigo-400/50 bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl shadow-indigo-700/30">
            <Icon name="dashboard" className="h-7 w-7 text-white" />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-indigo-100">
              HospiOS
            </span>
          </div>

          {/* orbiting categories */}
          {MODULE_CATEGORIES.map((c, i) => {
            const angle = (i / MODULE_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
            const x = 50 + 43 * Math.cos(angle);
            const y = 50 + 43 * Math.sin(angle);
            const selected = c.id === active;
            const style = CATEGORY_STYLE[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                aria-pressed={selected}
                aria-label={`${c.label} — ${c.blurb}`}
                title={c.blurb}
                className={`absolute z-20 flex aspect-square items-center justify-center rounded-2xl border bg-zinc-900/95 shadow-lg backdrop-blur transition ${
                  selected
                    ? `scale-110 ${style.ring} ring-2 ring-indigo-400/40`
                    : "border-zinc-700 hover:border-indigo-400/60 hover:scale-105"
                }`}
                style={{ left: `${x}%`, top: `${y}%`, width: "22%", transform: `translate(-50%,-50%) ${selected ? "scale(1.1)" : ""}` }}
              >
                <Icon name={c.icon as IconName} className={`h-6 w-6 ${selected ? "text-white" : "text-zinc-300"}`} />
                <span
                  aria-hidden="true"
                  className={`absolute right-0 top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full ${style.dot} sm:block`}
                />
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          One core, seven operating areas, 23 modules — everything connected.
        </p>
      </div>

      {/* Active category panel */}
      <div className="order-1 lg:order-2">
        <div key={cat.id} className="animate-fade-in rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
              <Icon name={cat.icon as IconName} className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                {cat.label}
              </p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">
                {`${cat.label} — ${modules.length} module${modules.length === 1 ? "" : "s"}`}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{cat.blurb}</p>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-indigo-500/40"
              >
                <p className="font-semibold text-zinc-100">{m.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{m.tagline}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}