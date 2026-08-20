/**
 * Pricing engine — pure, client-safe helpers used by the pricing page, the
 * home widget, the API routes and the admin manager.
 *
 * Display-only: the frontend renders what the pricing database says. The
 * authoritative price for a subscription is always re-resolved server-side
 * at checkout (see `resolvePricing`), never from the browser.
 */
import {
  FEATURE_MATRIX,
  getPlan,
  PLANS,
  ROOM_RECOMMENDATIONS,
  type FeatureLevel,
  type PlanCatalogEntry,
} from "./catalog";
import { getCurrency } from "./currencies";
import type { CurrencyMeta } from "./types";
import { countryListing, COUNTRY_HEADERS } from "./countries";
import { gatewayLabel } from "./defaults";
import type {
  BillingCycle,
  CountryResolution,
  PlanId,
  PricingProfile,
} from "./types";

/** Format an amount in a local currency (no decimals, local grouping). */
export function formatPrice(amount: number, currency: string): string {
  const meta = getCurrency(currency);
  const number = amount.toLocaleString(meta.locale, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return meta.symbolGap ? `${meta.symbol} ${number}` : `${meta.symbol}${number}`;
}

export function currencyMeta(currency: string): CurrencyMeta {
  return getCurrency(currency);
}

/** Savings from choosing yearly billing: 12 × monthly − annual. */
export function annualSavings(monthly: number, annual: number): number {
  return Math.max(0, monthly * 12 - annual);
}

export function priceFor(
  profile: PricingProfile,
  plan: PlanId,
  cycle: BillingCycle,
): number {
  const p = profile.prices[plan];
  return cycle === "yearly" ? p.annual : p.monthly;
}

/** Recommended plan for a room count (1–6 / 7–15 / 16–40 / 41–100 / 100+). */
export function recommendedPlan(rooms: number): PlanId {
  for (const band of ROOM_RECOMMENDATIONS) {
    if (rooms >= band.min && (band.max === null || rooms <= band.max)) {
      return band.plan;
    }
  }
  return "enterprise";
}

export function planById(id: PlanId): PlanCatalogEntry {
  return getPlan(id) ?? PLANS[0];
}

/** Card features for a plan (catalog data). */
export function cardFeatures(plan: PlanId): string[] {
  return planById(plan).cardFeatures;
}

export function isCustomPriced(plan: PlanId): boolean {
  return plan === "enterprise";
}

/** Human tax line, e.g. "GST included · 18%". */
export function taxLine(profile: PricingProfile): string {
  const t = profile.tax;
  if (t.mode === "none") return "No local tax shown";
  const stem = t.mode === "inclusive" ? "included" : "excluded";
  const rate = t.rate > 0 ? ` · ${Number.isInteger(t.rate) ? t.rate : t.rate}%` : "";
  return `${t.label} ${stem}${rate}`;
}

export function gatewayLabels(profile: PricingProfile): string[] {
  return profile.gateways.map(gatewayLabel);
}

/** Description of the country's tax state, used under prices. */
export function taxDescription(profile: PricingProfile): string {
  const t = profile.tax;
  if (t.mode === "none") return "No local tax shown";
  const stem = t.mode === "inclusive" ? "included in the price" : "may apply at checkout";
  const rate = t.rate > 0 ? ` (${t.rate}%)` : "";
  return `${t.label} ${stem}${rate}${t.note ? ` — ${t.note}` : ""}`;
}

/** Compare-matrix level for a plan, or null for "—". */
export function matrixLevel(row: (typeof FEATURE_MATRIX)[number], plan: PlanId): FeatureLevel {
  return row.levels[plan];
}

/**
 * Resolve the visitor's country from raw request headers (Geo-IP set by the
 * CDN/proxy) plus an optional manual billing-country cookie value.
 * Cookie wins (manual selection persists across visits); the header is the
 * detection; anything else falls back to the default global profile.
 */
export function resolveCountry(
  headers: Pick<Headers, "get">,
  cookieValue: string | undefined | null,
): CountryResolution {
  const manual = normalizeManualCountry(cookieValue);
  if (manual) {
    const l = countryListing(manual)!;
    return {
      country: l.code,
      name: l.name,
      flag: l.flag,
      currency: l.currency,
      source: "cookie",
    };
  }

  for (const name of COUNTRY_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const upper = raw.trim().toUpperCase();
    if (upper.length !== 2) continue;
    const l = countryListing(upper);
    if (l) {
      return {
        country: l.code,
        name: l.name,
        flag: l.flag,
        currency: l.currency,
        source: "header",
      };
    }
  }

  const def = countryListing("US")!;
  return {
    country: def.code,
    name: def.name,
    flag: def.flag,
    currency: def.currency,
    source: "default",
  };
}

/** Validate a manual cookie country code against the registry. */
export function normalizeManualCountry(value: string | undefined | null): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (upper.length !== 2) return null;
  return countryListing(upper) ? upper : null;
}