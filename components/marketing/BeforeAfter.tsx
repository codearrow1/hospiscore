"use client";

import { useState } from "react";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";

/**
 * Before/After — an honest contrast between fragmented manual operations and a
 * single connected platform. The "After" column describes real HospiOS
 * capabilities from lib/modules.ts; no invented numbers.
 */

type RowMode = "before" | "after";

const ROWS: {
  label: string;
  before: string;
  after: string;
  icon: IconName;
}[] = [
  {
    label: "Bookings & OTA",
    icon: "network",
    before: "Listings, inboxes and calendars in separate tabs; rates re-keyed by hand across each channel.",
    after: "Two-way inventory, rate and restriction sync across every major channel in real time.",
  },
  {
    label: "Front desk",
    icon: "frontdesk",
    before: "Paper or spreadsheet check-ins, re-keyed into billing afterwards.",
    after: "Express check-in with ID, deposits, keys and folio all on one screen.",
  },
  {
    label: "Housekeeping",
    icon: "shirt",
    before: "Cleaning status shared by phone calls and printed lists.",
    after: "Checkout creates a cleaning task instantly; the housekeeping board updates live.",
  },
  {
    label: "Billing & night audit",
    icon: "coins",
    before: "Hours spent reconciling folios, taxes and cash across screens.",
    after: "Guest folio, GST invoice and a single-pass night audit — reconciled and reported.",
  },
  {
    label: "Guest experience",
    icon: "guest",
    before: "Guests wait at the desk and repeat their preferences every stay.",
    after: "Digital check-in, self-service requests and a guest profile that remembers everything.",
  },
  {
    label: "Reporting",
    icon: "trend",
    before: "Exporting sheets and assembling occupancy reports by hand.",
    after: "Live dashboards for occupancy, revenue, ADR and RevPAR — no assembly required.",
  },
];

export default function BeforeAfter() {
  const [mode, setMode] = useState<RowMode>("after");

  return (
    <div>
      {/* Toggle */}
      <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/70 p-1.5" role="tablist" aria-label="Compare before and after">
        {(["before", "after"] as RowMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              mode === m
                ? m === "before"
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {m === "before" ? "Before" : "After HospiOS"}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-3">
        {ROWS.map((r) => {
          const isAfter = mode === "after";
          return (
            <div key={r.label} className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                <Icon name={r.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-200">{r.label}</p>
                {/* keep both texts in DOM for a11y; toggle visibility */}
                <p
                  className={`mt-1 text-sm leading-relaxed transition ${
                    isAfter ? "hidden text-zinc-400" : "block text-zinc-400"
                  }`}
                >
                  {r.before}
                </p>
                <p
                  className={`mt-1 text-sm leading-relaxed transition ${
                    isAfter ? "block text-indigo-200" : "hidden text-indigo-200"
                  }`}
                >
                  {r.after}
                </p>
              </div>
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isAfter ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-400"
                }`}
                aria-hidden="true"
              >
                {isAfter && <span className="text-sm font-bold">✓</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}