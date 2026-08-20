"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BillingCycle, CountryResolution } from "@/lib/pricing/types";
import type { PricingSnapshot } from "@/lib/pricing/snapshot";
import {
  annualSavings,
  formatPrice,
  priceFor,
  recommendedPlan,
  taxDescription,
  taxLine,
} from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";
import { LEVEL_LABELS, type FeatureLevel } from "@/lib/pricing/catalog";

/**
 * Interactive localized pricing experience. Country selection, billing cycle,
 * plan cards, room calculator and comparison matrix all share one snapshot of
 * the pricing database (server-rendered, no runtime fetches on this page).
 */

function setBillingCountryCookie(code: string) {
  document.cookie = `${BILLING_COUNTRY_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

function planHref(plan: string, country: string, cycle: BillingCycle): string {
  return `/demo?plan=${encodeURIComponent(plan)}&country=${encodeURIComponent(country)}&cycle=${encodeURIComponent(cycle)}`;
}

/** ── Country selector (button + dropdown + search) ── */
function CountryPicker({
  snapshot,
  country,
  onChange,
}: {
  snapshot: PricingSnapshot;
  country: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = snapshot.countries.filter((c) => {
      if (!c.enabled) return false;
      const profile = snapshot.profiles[c.code];
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (profile?.currency ?? "").toLowerCase().includes(q)
      );
    });
    return list;
  }, [snapshot, query]);

  const current = snapshot.countries.find((c) => c.code === country)
    ?? { code: country, name: country, flag: "", region: "global" as const, currency: "USD", enabled: true };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-indigo-500"
      >
        {current.flag && <span aria-hidden="true">{current.flag}</span>}
        <span>{current.name}</span>
        <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            aria-label="Select your country"
            className="absolute left-0 z-50 mt-2 max-h-96 w-72 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50"
          >
            <div className="border-b border-zinc-800 p-2">
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries"
                aria-label="Search countries"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto p-1.5">
              {matches.map((c) => {
                const currency = snapshot.currencies[c.currency];
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.code === country}
                      onClick={() => {
                        onChange(c.code);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        c.code === country
                          ? "bg-indigo-600/20 text-indigo-200"
                          : "text-zinc-200 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {c.flag && <span aria-hidden="true">{c.flag}</span>}
                        <span>{c.name}</span>
                      </span>
                      <span className="text-xs text-zinc-500">
                        {currency?.symbol ?? c.currency}
                      </span>
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-zinc-500">
                  No countries match “{query}”.
                </li>
              )}
            </ul>
            <div className="border-t border-zinc-800 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Your billing country determines the price shown at checkout.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** ── Monthly / yearly toggle ── */
function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  const options: { id: BillingCycle; label: string; note?: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "yearly", label: "Yearly", note: "2 months free" },
  ];
  return (
    <div role="group" aria-label="Billing cycle" className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={cycle === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            cycle === o.id
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
          {o.note && (
            <span className={`ml-1.5 text-[10px] font-normal ${cycle === o.id ? "text-indigo-200" : "text-zinc-500"}`}>
              {o.note}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** ── Plan cards ── */
function PlanCards({
  snapshot,
  country,
  cycle,
}: {
  snapshot: PricingSnapshot;
  country: string;
  cycle: BillingCycle;
}) {
  const profile = snapshot.profiles[country];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-stretch" id="plans">
      {snapshot.plans.map((plan) => {
        const price = profile ? priceFor(profile, plan.id, cycle) : 0;
        const monthly = profile ? profile.prices[plan.id].monthly : 0;
        const savings = cycle === "yearly" && profile
          ? annualSavings(monthly, profile.prices[plan.id].annual)
          : 0;
        const isEnterprise = plan.id === "enterprise";
        const limitRooms =
          plan.roomMax === null
            ? "Custom / unlimited"
            : plan.roomMax > plan.roomMin
              ? `${plan.roomMin}–${plan.roomMax} rooms`
              : `Up to ${plan.roomMax} rooms`;
        const limits =
          plan.adminLimit === null
            ? "Custom team size"
            : `${plan.adminLimit} Admin${plan.adminLimit === 1 ? "" : "s"} · ${plan.staffLimit} Staff`;

        const featured = Boolean(plan.featured);
        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-3xl border p-6 transition duration-300 ${
              featured
                ? "glow-border border-indigo-500 bg-indigo-950/30 -mx-1 xl:-translate-y-2 xl:scale-[1.02]"
                : "border-zinc-800 bg-zinc-900/60 hover:border-indigo-600/60"
            }`}
          >
            {featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30">
                Most Popular
              </span>
            )}

            <h3 className={`text-base font-bold ${featured ? "text-white" : "text-zinc-50"}`}>
              {plan.name}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">{plan.tagline}</p>

            <div className="mt-4 min-h-14">
              {isEnterprise ? (
                <>
                  <p className="text-3xl font-bold tracking-tight text-zinc-50">Custom</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Scoped for groups, chains & multi-property operations
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
                    {formatPrice(price, profile?.currency ?? "USD")}
                    <span className="text-base font-medium text-zinc-500">
                      {cycle === "yearly" ? "/year" : "/month"}
                    </span>
                  </p>
                  {savings > 0 && (
                    <p className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      Save {formatPrice(savings, profile?.currency ?? "USD")}
                    </p>
                  )}
                </>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs">
              <div>
                <dt className="text-zinc-500">Rooms</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{limitRooms}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Team</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{limits}</dd>
              </div>
            </dl>

            <ul className="mt-4 flex flex-1 flex-col gap-2 text-xs text-zinc-400">
              {plan.cardFeatures.map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <p className="mb-2 text-[11px] text-zinc-500">
                {profile ? taxLine(profile) : ""}
              </p>
              <Link
                href={planHref(plan.id, country, cycle)}
                className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  featured
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border border-zinc-700 text-zinc-100 hover:border-indigo-500 hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** ── Room calculator ── */
function RoomCalculator({
  snapshot,
  country,
  cycle,
}: {
  snapshot: PricingSnapshot;
  country: string;
  cycle: BillingCycle;
}) {
  const [rooms, setRooms] = useState(24);
  const profile = snapshot.profiles[country];
  const planId = recommendedPlan(rooms);
  const plan = snapshot.plans.find((p) => p.id === planId) ?? snapshot.plans[0];
  const price = profile ? priceFor(profile, planId, cycle) : 0;
  const monthly = profile ? profile.prices[planId].monthly : 0;
  const savings =
    cycle === "yearly" && profile ? annualSavings(monthly, profile.prices[planId].annual) : 0;

  const chips = [6, 15, 40, 100];

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <label htmlFor="pricing-rooms" className="text-sm font-medium text-zinc-300">
            How many rooms does your property have?
          </label>
          <div className="mt-2 flex items-center gap-4">
            <input
              id="pricing-rooms"
              type="number"
              min={1}
              max={5000}
              value={rooms}
              onChange={(e) => {
                const n = Math.max(1, Math.min(5000, Number(e.target.value) || 1));
                setRooms(n);
              }}
              className="w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-lg font-bold tabular-nums text-zinc-50 outline-none transition focus:border-indigo-500"
            />
            <span className="text-sm text-zinc-500">rooms</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRooms(n)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  rooms === n
                    ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                    : "border-zinc-700 text-zinc-400 hover:border-indigo-500/60"
                }`}
              >
                {n} rooms
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-col gap-1 rounded-2xl border p-5 ${
          plan.featured ? "border-indigo-500/60 bg-indigo-950/30" : "border-zinc-700 bg-zinc-950/60"
        }`}>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Based on your property size
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-50">
            {plan.name} is recommended{" "}
            {plan.featured && (
              <span className="ml-1 inline-flex rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Most Popular
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {profile
              ? plan.id === "enterprise"
                ? "Custom pricing — talk to our sales team."
                : `${formatPrice(price, profile.currency)} ${
                    cycle === "yearly" ? "/year" : "/month"
                  }${cycle === "yearly" && savings > 0 ? ` · save ${formatPrice(savings, profile.currency)}` : ""}`
              : ""}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {plan.roomMax === null
              ? "For groups of 100+ rooms"
              : `Covers ${plan.roomMin}–${plan.roomMax} rooms`}
          </p>
          <Link
            href={planHref(plan.id, country, cycle)}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Book a demo for {plan.name}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** ── Compare matrix (columns = plans; selected column highlighted) ── */
function CompareMatrix({ snapshot }: { snapshot: PricingSnapshot }) {
  const levelStyle: Record<Exclude<FeatureLevel, null>, { label: string; cls: string; icon: "check" | "dot" }> = {
    included: { label: "Included", cls: "text-emerald-400", icon: "check" },
    advanced: { label: "Advanced", cls: "text-amber-400", icon: "dot" },
    addon: { label: "Add-on", cls: "text-zinc-400", icon: "dot" },
    enterprise: { label: "Enterprise", cls: "text-indigo-400", icon: "dot" },
  };

  return (
    <div className="overflow-x-auto rounded-3xl border border-zinc-800">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Feature
            </th>
            {snapshot.plans.map((p) => (
              <th key={p.id} className={`px-4 py-4 text-center ${p.featured ? "bg-indigo-950/40" : ""}`}>
                <span className={`text-base font-bold ${p.featured ? "text-indigo-300" : "text-zinc-100"}`}>
                  {p.name}
                </span>
                <span className="block text-xs font-normal text-zinc-500">{p.tagline}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.matrix.map((row, ri) => (
            <tr
              key={row.label}
              className={`border-b border-zinc-800 last:border-0 ${ri % 2 ? "bg-zinc-900/40" : "bg-zinc-950"}`}
            >
              <td className="px-5 py-3.5 text-zinc-300">{row.label}</td>
              {snapshot.plans.map((p) => {
                const level = row.levels[p.id];
                const meta = level ? levelStyle[level] : null;
                return (
                  <td key={p.id} className={`px-4 py-3.5 text-center ${p.featured ? "bg-indigo-950/20" : ""}`}>
                    {level && meta ? (
                      <span className="flex items-center justify-center gap-1.5 text-xs">
                        {meta.icon === "check" ? (
                          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-label="Included">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className={`h-2 w-2 rounded-full ${meta.cls}`} aria-hidden="true" />
                        )}
                        <span className={meta.cls}>{meta.label}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600" aria-label="Not included">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ── Tax & payment panel for the selected country ── */
function TaxAndPayment({ snapshot, country }: { snapshot: PricingSnapshot; country: string }) {
  const profile = snapshot.profiles[country];
  if (!profile) return null;
  const list = snapshot.countries.find((c) => c.code === country);
  const currency = snapshot.currencies[profile.currency];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Taxes</h3>
        <p className="mt-2 text-sm text-zinc-300">{taxLine(profile)}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{taxDescription(profile)}</p>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Payment methods</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.gateways.map((g) => (
            <span key={g} className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
              {snapshot.gatewayLabels[g] ?? g}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {list?.name ?? country} · {profile.currency}
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Billing country</h3>
        <p className="mt-2 text-sm text-zinc-300">
          {currency?.symbol ?? profile.currency} prices for {list?.name ?? country}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Your billing country determines the price shown at checkout. We
          validate it against your location when you book.
        </p>
      </div>
    </div>
  );
}

/** ── Root experience: sticky controls, cards, calculator, matrix, tax ── */
export default function PricingExperience({
  snapshot,
  initial,
}: {
  snapshot: PricingSnapshot;
  initial: CountryResolution;
}) {
  const [country, setCountry] = useState(initial.country);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const selected = snapshot.countries.find((c) => c.code === country);

  function changeCountry(code: string) {
    setCountry(code);
    if (snapshot.profiles[code]) setBillingCountryCookie(code);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* Sticky controls bar */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CountryPicker snapshot={snapshot} country={country} onChange={changeCountry} />
            <span className="hidden text-sm text-zinc-400 sm:inline">
              Pricing for{" "}
              <span className="font-semibold text-zinc-100">
                {selected?.flag ? `${selected.flag} ` : ""}
                {selected?.name ?? country}
              </span>
            </span>
          </div>
          <BillingToggle cycle={cycle} onChange={setCycle} />
        </div>
      </div>

      {/* Plan cards */}
      <section className="py-10 sm:py-12">
        <PlanCards snapshot={snapshot} country={country} cycle={cycle} />
      </section>

      {/* Room calculator */}
      <section className="border-y border-zinc-800 bg-zinc-900/40 py-14">
        <RoomCalculator snapshot={snapshot} country={country} cycle={cycle} />
      </section>

      {/* Compare matrix */}
      <section id="compare" className="scroll-mt-24 py-14">
        <CompareMatrix snapshot={snapshot} />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {Object.entries(LEVEL_LABELS).map(([level, label]) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-zinc-600" aria-hidden="true">—</span>
            Not included
          </span>
        </div>
      </section>

      {/* Tax & payment */}
      <section className="border-t border-zinc-800 py-14">
        <TaxAndPayment snapshot={snapshot} country={country} />
      </section>
    </div>
  );
}