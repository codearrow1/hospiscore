/**
 * Builds the serializable pricing snapshot the pricing page and the public
 * catalog API serve. Client-safe: type-only imports only.
 */
import { getPricingDoc } from "./db";
import {
  FEATURE_MATRIX,
  PLANS,
  EVERY_PLAN_INCLUDES,
  PRICING_FAQS,
  type CompareRow,
  type PlanCatalogEntry,
} from "./catalog";
import { countryListing } from "./countries";
import { CURRENCIES } from "./currencies";
import { gatewayLabel } from "./defaults";
import type {
  CurrencyMeta,
  CountryListing,
  PricingProfile,
  PricingDoc,
} from "./types";

export interface PricingSnapshot {
  version: number;
  updatedAt: string;
  defaultCountry: string;
  /** All countries that have a profile; enabled ones first. */
  countries: CountryListing[];
  plans: PlanCatalogEntry[];
  matrix: CompareRow[];
  includes: string[];
  faqs: { q: string; a: string }[];
  currencies: Record<string, CurrencyMeta>;
  gatewayLabels: Record<string, string>;
  profiles: Record<string, PricingProfile>;
}

function listingFor(profile: PricingProfile): CountryListing | null {
  const seed = countryListing(profile.country);
  if (seed) return seed;
  if (profile.name) {
    return {
      code: profile.country,
      name: profile.name,
      flag: profile.flag ?? "",
      region: profile.region,
      currency: profile.currency,
      enabled: true,
    };
  }
  return null;
}

/** Server-only: assemble the snapshot from the active pricing doc. */
export async function buildPricingSnapshot(
  target?: string,
): Promise<PricingSnapshot> {
  const doc: PricingDoc = await getPricingDoc(target);

  const countries: CountryListing[] = (
    await Promise.all(
      Object.values(doc.profiles)
        .map(listingFor)
        .filter((l): l is CountryListing => l !== null),
    )
  )
    .map((l) => ({ ...l, enabled: true }))
    .sort(
      (a, b) =>
        Number(b.enabled) - Number(a.enabled) ||
        a.name.localeCompare(b.name),
    );

  const gatewayLabels: Record<string, string> = {};
  for (const p of Object.values(doc.profiles)) {
    for (const g of p.gateways) gatewayLabels[g] = gatewayLabel(g);
  }

  return {
    version: doc.version,
    updatedAt: doc.updatedAt,
    defaultCountry: "US",
    countries,
    plans: [...PLANS],
    matrix: [...FEATURE_MATRIX],
    includes: EVERY_PLAN_INCLUDES,
    faqs: PRICING_FAQS,
    currencies: Object.fromEntries(
      [...new Set(Object.values(doc.profiles).map((p) => p.currency))].map(
        (code) => [code, CURRENCIES[code]],
      ),
    ),
    gatewayLabels,
    profiles: doc.profiles,
  };
}