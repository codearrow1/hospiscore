"use client";

import { useState } from "react";
import Link from "next/link";
import { BILLING_CYCLES, PLANS, ROOM_BANDS, planMonthlyCost } from "@/lib/pricing";
import type { BillingCycle } from "@/lib/pricing";

const INR_PER_USD = 83;

export default function PricingCalculator() {
  const [band, setBand] = useState(ROOM_BANDS[1]);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<"usd" | "inr">("usd");

  function format(value: number): string {
    if (currency === "inr") {
      return `₹${Math.round(value * INR_PER_USD).toLocaleString("en-IN")}`;
    }
    return `$${value.toLocaleString("en-US")}`;
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-300">Rooms in your property</span>
          <select
            value={band.label}
            onChange={(e) => {
              const next = ROOM_BANDS.find((b) => b.label === e.target.value) ?? ROOM_BANDS[0];
              setBand(next);
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-indigo-500"
          >
            {ROOM_BANDS.map((b) => (
              <option key={b.label} value={b.label}>
                {b.label} ({b.rooms} rooms)
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-300">Billing cycle</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1">
            {BILLING_CYCLES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCycle(c.id)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  cycle === c.id
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-pressed={cycle === c.id}
              >
                {c.label}
                {c.note && <span className="ml-1 text-[10px] opacity-70">{c.note}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-300">Currency</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1">
            {(["usd", "inr"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  currency === c ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-pressed={currency === c}
              >
                {c === "usd" ? "USD $" : "INR ₹"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Estimated monthly cost for <span className="font-semibold text-zinc-300">{band.rooms} rooms</span>{" "}
        ({cycle === "yearly" ? "yearly — 2 months free" : "monthly"}).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const cost = planMonthlyCost(plan, band.rooms, cycle);
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                plan.featured
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-950/50"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-indigo-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="font-semibold text-zinc-50">{plan.name}</h3>
              <p className="mt-1 text-xs text-zinc-400">{plan.blurb}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-50">
                {format(cost)}
                <span className="text-sm font-normal text-zinc-500">/mo</span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {format(plan.perRoomUsd)}/room/mo · {band.rooms} rooms
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-xs text-zinc-400">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/demo"
                className={`mt-5 inline-flex justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border border-zinc-700 text-zinc-200 hover:border-indigo-500/60 hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
