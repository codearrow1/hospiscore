/**
 * Country registry for localized pricing. Extensible to 100+ countries —
 * admins can enable/edit any entry and add new ones via the pricing manager.
 * Prices live in `defaults.ts` (the seeded pricing database), not here.
 */
import type { CountryListing, PricingRegion } from "./types";

/** Seed countries configured for localized pricing. */
export const SEED_COUNTRIES: readonly CountryListing[] = [
  { code: "US", name: "United States", flag: "🇺🇸", region: "na", currency: "USD", enabled: true },
  { code: "IN", name: "India", flag: "🇮🇳", region: "asia", currency: "INR", enabled: true },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "europe", currency: "GBP", enabled: true },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "na", currency: "CAD", enabled: true },
  { code: "AU", name: "Australia", flag: "🇦🇺", region: "oceania", currency: "AUD", enabled: true },
  { code: "DE", name: "Germany", flag: "🇩🇪", region: "europe", currency: "EUR", enabled: true },
  { code: "FR", name: "France", flag: "🇫🇷", region: "europe", currency: "EUR", enabled: true },
  { code: "AE", name: "UAE", flag: "🇦🇪", region: "mena", currency: "AED", enabled: true },
  { code: "SG", name: "Singapore", flag: "🇸🇬", region: "asia", currency: "SGD", enabled: true },
  { code: "NP", name: "Nepal", flag: "🇳🇵", region: "asia", currency: "NPR", enabled: true },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", region: "asia", currency: "BDT", enabled: true },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", region: "asia", currency: "PKR", enabled: true },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", region: "asia", currency: "LKR", enabled: true },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "africa", currency: "NGN", enabled: true },
  { code: "KE", name: "Kenya", flag: "🇰🇪", region: "africa", currency: "KES", enabled: true },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", region: "africa", currency: "ZAR", enabled: true },
];

/** Default global profile for undetected / unsupported countries. */
export const DEFAULT_COUNTRY = "US";

/** Header names a CDN/proxy may set with the client country (Geo-IP). */
export const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "x-hcdn-country",
  "x-geo-country",
  "cloudfront-viewer-country",
] as const;

/** Billing-country cookie. Set by the selector; read server-side too. */
export const BILLING_COUNTRY_COOKIE = "hs_billing_country";

const byCode = new Map(SEED_COUNTRIES.map((c) => [c.code, c]));

export function countryListing(code: string): CountryListing | undefined {
  return byCode.get(code.toUpperCase());
}

/** Resolve a raw two-letter country code against the registry. */
export function normalizeCountryCode(code: string | undefined | null): string {
  if (!code) return DEFAULT_COUNTRY;
  const upper = code.trim().toUpperCase();
  return byCode.has(upper) ? upper : DEFAULT_COUNTRY;
}

export function regionLabel(region: PricingRegion): string {
  switch (region) {
    case "na":
      return "North America";
    case "europe":
      return "Europe";
    case "mena":
      return "Middle East & Africa (GCC)";
    case "asia":
      return "Asia-Pacific";
    case "africa":
      return "Africa";
    case "oceania":
      return "Oceania";
    default:
      return "Global";
  }
}