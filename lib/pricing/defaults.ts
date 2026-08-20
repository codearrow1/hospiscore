/**
 * Seeded pricing database. These are the independently-set local market
 * prices for each country — deliberately NOT exchange-rate conversions.
 * Every value is admin-editable at /account/pricing; edits create a new
 * pricing version so existing subscriptions keep their original price.
 *
 * Annual = ten months of the monthly price (≈ two months free), configured
 * per country. Savings are computed from the stored annual price.
 */
import type { PlanId, PricingProfile, TaxProfile, PaymentGateway } from "./types";

function planPrices(
  solo: number, starter: number, growth: number, professional: number,
): Record<PlanId, { monthly: number; annual: number }> {
  const entries = [
    ["solopreneur", solo],
    ["starter", starter],
    ["growth", growth],
    ["professional", professional],
  ] as const;
  const out = {} as Record<PlanId, { monthly: number; annual: number }>;
  for (const [plan, monthly] of entries) {
    // Round annual to a whole number; defaults to 10 × monthly.
    out[plan] = { monthly, annual: Math.round(monthly * 10) };
  }
  // Enterprise is custom-priced; the entry keeps the per-plan shape for UI.
  out.enterprise = { monthly: 0, annual: 0 };
  return out;
}

interface SeedProfile {
  country: string;
  currency: string;
  region: PricingProfile["region"];
  tax: TaxProfile;
  gateways: string[];
  prices: ReturnType<typeof planPrices>;
}

function seed(): Record<string, SeedProfile> {
  const def = (tax: TaxProfile, gateways: string[]) => ({
    country: "US",
    currency: "USD",
    region: "na" as const,
    tax,
    gateways,
    prices: planPrices(49, 89, 179, 299),
  });

  return {
    US: def(
      { mode: "exclusive", label: "Sales tax", rate: 0, note: "Sales tax may apply depending on your location." },
      ["cards", "ach"],
    ),
    IN: {
      country: "IN",
      currency: "INR",
      region: "asia",
      tax: { mode: "inclusive", label: "GST", rate: 18, note: "GSTIN-supported business billing and tax invoices available." },
      gateways: ["upi", "cards", "netbanking"],
      prices: planPrices(999, 1999, 3999, 6999),
    },
    GB: {
      country: "GB",
      currency: "GBP",
      region: "europe",
      tax: { mode: "inclusive", label: "VAT", rate: 20 },
      gateways: ["cards", "directdebit"],
      prices: planPrices(49, 89, 179, 299),
    },
    CA: {
      country: "CA",
      currency: "CAD",
      region: "na",
      tax: { mode: "exclusive", label: "Sales tax", rate: 0, note: "GST/HST may apply depending on your province." },
      gateways: ["cards", "interac"],
      prices: planPrices(64, 119, 239, 399),
    },
    AU: {
      country: "AU",
      currency: "AUD",
      region: "oceania",
      tax: { mode: "inclusive", label: "GST", rate: 10 },
      gateways: ["cards", "banktransfer"],
      prices: planPrices(69, 129, 259, 429),
    },
    DE: {
      country: "DE",
      currency: "EUR",
      region: "europe",
      tax: { mode: "inclusive", label: "VAT", rate: 19 },
      gateways: ["cards", "sepa"],
      prices: planPrices(54, 99, 199, 329),
    },
    FR: {
      country: "FR",
      currency: "EUR",
      region: "europe",
      tax: { mode: "inclusive", label: "VAT", rate: 20 },
      gateways: ["cards", "sepa"],
      prices: planPrices(54, 99, 199, 329),
    },
    AE: {
      country: "AE",
      currency: "AED",
      region: "mena",
      tax: { mode: "inclusive", label: "VAT", rate: 5 },
      gateways: ["cards", "banktransfer"],
      prices: planPrices(199, 349, 699, 1099),
    },
    SG: {
      country: "SG",
      currency: "SGD",
      region: "asia",
      tax: { mode: "inclusive", label: "GST", rate: 9 },
      gateways: ["cards", "paynow"],
      prices: planPrices(69, 129, 259, 429),
    },
    NP: {
      country: "NP",
      currency: "NPR",
      region: "asia",
      tax: { mode: "inclusive", label: "GST", rate: 13 },
      gateways: ["cards", "netbanking"],
      prices: planPrices(2499, 4999, 9999, 17999),
    },
    BD: {
      country: "BD",
      currency: "BDT",
      region: "asia",
      tax: { mode: "inclusive", label: "VAT", rate: 5 },
      gateways: ["cards", "mobilewallet"],
      prices: planPrices(2999, 5999, 11999, 19999),
    },
    PK: {
      country: "PK",
      currency: "PKR",
      region: "asia",
      tax: { mode: "inclusive", label: "Sales tax", rate: 17 },
      gateways: ["cards", "mobilewallet"],
      prices: planPrices(12999, 24999, 49999, 84999),
    },
    LK: {
      country: "LK",
      currency: "LKR",
      region: "asia",
      tax: { mode: "inclusive", label: "VAT", rate: 18 },
      gateways: ["cards", "netbanking"],
      prices: planPrices(12999, 24999, 49999, 79999),
    },
    NG: {
      country: "NG",
      currency: "NGN",
      region: "africa",
      tax: { mode: "inclusive", label: "VAT", rate: 7.5 },
      gateways: ["cards", "banktransfer"],
      prices: planPrices(45000, 85000, 170000, 285000),
    },
    KE: {
      country: "KE",
      currency: "KES",
      region: "africa",
      tax: { mode: "inclusive", label: "VAT", rate: 16 },
      gateways: ["cards", "mpesa"],
      prices: planPrices(9999, 18999, 37999, 64999),
    },
    ZA: {
      country: "ZA",
      currency: "ZAR",
      region: "africa",
      tax: { mode: "inclusive", label: "VAT", rate: 15 },
      gateways: ["cards", "eft"],
      prices: planPrices(1099, 1999, 3999, 6999),
    },
  };
}

export const SEED_PROFILES: Record<string, PricingProfile> = Object.fromEntries(
  Object.entries(seed()).map(([code, p]) => [code, { ...p }]),
);

/** Payment gateway labels (id → display label). */
export const GATEWAY_LABELS: Record<string, string> = {
  cards: "Cards",
  upi: "UPI",
  netbanking: "Net banking",
  ach: "ACH",
  directdebit: "Direct Debit",
  interac: "Interac",
  banktransfer: "Bank transfer",
  sepa: "SEPA Direct Debit",
  paynow: "PayNow",
  mobilewallet: "Mobile wallets",
  mpesa: "M-Pesa",
  eft: "EFT",
};

export function gatewayLabel(id: string): string {
  return GATEWAY_LABELS[id] ?? id;
}

export function listGateways(): PaymentGateway[] {
  return Object.entries(GATEWAY_LABELS).map(([id, label]) => ({ id, label }));
}