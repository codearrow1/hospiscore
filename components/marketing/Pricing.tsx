"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice, priceFor } from "@/lib/pricing/engine";
import type { PricingSnapshot } from "@/lib/pricing/snapshot";

/**
 * Compact home-page pricing widget. Renders immediately with the default
 * profile (US), then refines to the visitor's detected country from the
 * public pricing API. Full interactive experience lives on /pricing.
 */

const USD_DEFAULTS: PricingSnapshot = {
  version: 1,
  updatedAt: "",
  defaultCountry: "US",
  countries: [{ code: "US", name: "United States", flag: "🇺🇸", region: "na", currency: "USD", enabled: true }],
  plans: [],
  matrix: [],
  includes: [],
  faqs: [],
  currencies: {},
  gatewayLabels: {},
  profiles: {},
};

export default function Pricing() {
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, geo] = await Promise.all([
          fetch("/api/pricing/catalog", { cache: "no-store" }),
          fetch("/api/pricing/geolocate", { cache: "no-store" }),
        ]);
        if (!cat.ok || !geo.ok) return;
        const catalog = (await cat.json()) as PricingSnapshot;
        const resolution = (await geo.json()) as { country: string };
        if (cancelled) return;
        setSnapshot(catalog);
        setCountry(resolution.country);
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = snapshot ?? USD_DEFAULTS;
  const code = country ?? current.defaultCountry;
  const profile = current.profiles[code];

  const tiers = (current.plans.length ? current.plans : []).slice(0, 5);
  if (tiers.length === 0) {
    return (
      <div className="grid min-h-[320px] gap-5 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {tiers.map((tier, index) => {
        const isEnterprise = tier.id === "enterprise";
        const price = profile && !isEnterprise ? priceFor(profile, tier.id, "monthly") : 0;
        const featured = index === 2 || Boolean(tier.featured);
        return (
          <div
            key={tier.id}
            className={`relative flex flex-col rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 ${
              featured
                ? "glow-border border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:shadow-xl"
            }`}
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
              {featured ? "Most popular" : "Popular"}
            </span>
            <h3 className={`text-lg font-semibold ${featured ? "text-white" : "text-zinc-100"}`}>
              {tier.name}
            </h3>
            <p className={`mt-2 text-sm ${featured ? "text-indigo-100" : "text-zinc-400"}`}>
              {tier.tagline}
            </p>
            <div className="mt-5 flex min-h-12 items-baseline gap-1">
              {isEnterprise ? (
                <span className="text-4xl font-bold tracking-tight">Custom</span>
              ) : (
                <>
                  <span className="text-4xl font-bold tracking-tight">
                    {profile ? formatPrice(price, profile.currency) : "—"}
                  </span>
                  <span className={`text-sm ${featured ? "text-indigo-100" : "text-zinc-400"}`}>
                    /month
                  </span>
                </>
              )}
            </div>

            <ul className={`mt-5 flex flex-1 flex-col gap-2.5 text-sm ${featured ? "text-indigo-50" : "text-zinc-300"}`}>
              {(tier.cardFeatures ?? []).slice(0, 5).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? "text-white" : "text-emerald-500"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/pricing"
              className={`btn-shine btn-arrow mt-6 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                featured
                  ? "bg-white text-indigo-700 hover:bg-indigo-50"
                  : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              }`}
            >
              {tier.cta}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        );
      })}
    </div>
  );
}