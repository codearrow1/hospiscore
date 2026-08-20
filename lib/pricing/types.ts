/**
 * Shared types for the localized pricing engine (client-safe, serializable).
 *
 * The pricing engine is configuration-driven: display data lives in
 * `catalog.ts` / `countries.ts`, price data lives in the seeded pricing
 * database (`defaults.ts` + `db.ts`). UI components never hardcode prices.
 */

/** The five standard plans, in display order. */
export type PlanId =
  | "solopreneur"
  | "starter"
  | "growth"
  | "professional"
  | "enterprise";

/** Pricing regions used to group countries for strategy/rollouts. */
export type PricingRegion =
  | "na"
  | "europe"
  | "mena"
  | "asia"
  | "africa"
  | "oceania"
  | "global";

export type BillingCycle = "monthly" | "yearly";

/** ISO 4217 metadata used for local currency formatting. */
export interface CurrencyMeta {
  /** ISO 4217 code, e.g. "USD". */
  code: string;
  /** Display symbol, e.g. "₹". Two-part symbols are kept verbatim ("KSh"). */
  symbol: string;
  /** Space between symbol and the number ("KSh 9,999" vs "$49"). */
  symbolGap: boolean;
  /** Locale used for grouping/digit formatting ("en-IN" for lakh grouping). */
  locale: string;
  /** Fraction digits to show (0 for whole-price markets). */
  decimals: 0 | 2;
}

export type TaxMode = "inclusive" | "exclusive" | "none";

export interface TaxProfile {
  mode: TaxMode;
  /** Display label, e.g. "GST", "VAT", "Sales tax". */
  label: string;
  /** Rate in percent (0 when not applicable). */
  rate: number;
  /** Optional note shown near prices, e.g. GSTIN support for India. */
  note?: string;
}

export interface PaymentGateway {
  id: string;
  label: string;
}

/** A configured country (extends beyond the seeded set via admin tools). */
export interface CountryListing {
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  code: string;
  name: string;
  /** Emoji flag (used only in the country selector). */
  flag: string;
  region: PricingRegion;
  /** ISO 4217 currency code → resolved via the currency registry. */
  currency: string;
  enabled: boolean;
}

/** One plan's local prices for one country (in local currency units). */
export interface PlanPrice {
  monthly: number;
  /** Charged once per year. Configurable per country (defaults to 10 × monthly). */
  annual: number;
}

/** The commercial profile for a single country. */
export interface PricingProfile {
  country: string;
  /** Display name for countries beyond the seed registry (e.g. admin-added). */
  name?: string;
  /** Emoji flag for countries beyond the seed registry. */
  flag?: string;
  currency: string;
  region: PricingRegion;
  tax: TaxProfile;
  /** Ordered list of payment gateway ids (labels resolve via the registry). */
  gateways: string[];
  /**
   * Optional regional pricing multiplier. Informational only; actual unit
   * prices are stored independently and never derived from this at runtime.
   */
  multiplier?: number;
  prices: Record<PlanId, PlanPrice>;
}

/** A snapshot of every country's pricing, kept for price-versioning. */
export interface PricingVersion {
  version: number;
  createdAt: string;
  label: string;
  byEmail: string;
  profiles: Record<string, PricingProfile>;
}

/** The persisted pricing document (stored in the shared data file). */
export interface PricingDoc {
  version: number;
  updatedAt: string;
  /** All currently-active country profiles (enabled or disabled). */
  profiles: Record<string, PricingProfile>;
  /** Historical versions. Existing subscriptions keep the version they were
   *  created on; new customers use `version`. */
  history: PricingVersion[];
}

/** Result of resolving the visitor's country. */
export interface CountryResolution {
  country: string;
  name: string;
  flag: string;
  currency: string;
  source: "cookie" | "header" | "default";
}