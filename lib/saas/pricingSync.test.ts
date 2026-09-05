import { describe, it, expect } from "vitest";
import {
  validateCountryPriceEntry,
  validateCountryPriceEntries,
  isValidIsoAmount,
} from "./pricingSync";
import { splitCountryPrices } from "./planSync";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";

describe("country price validation", () => {
  it("accepts a valid entry and normalizes the ISO2 code", () => {
    const v = validateCountryPriceEntry({ country: "in", monthly: 1999, annual: 19990 });
    expect(v).toEqual({ ok: true, value: { country: "IN", currency: "INR", monthly: 1999, annual: 19990 } });
  });

  it("forces the catalog currency of the market", () => {
    const v = validateCountryPriceEntry({ country: "DE", currency: "EUR", monthly: 79, annual: 790 });
    expect(v.ok && v.value.currency === "EUR").toBe(true);
    const bad = validateCountryPriceEntry({ country: "DE", currency: "USD", monthly: 79, annual: 790 });
    expect(!bad.ok && bad.error).toMatch(/must be EUR/);
  });

  it("rejects unknown markets", () => {
    const v = validateCountryPriceEntry({ country: "XX", monthly: 10, annual: 100 });
    expect(!v.ok && v.error).toMatch(/unknown country/i);
  });

  it("rejects negative, fractional and missing amounts", () => {
    expect(isValidIsoAmount(-1)).toBe(false);
    expect(isValidIsoAmount(99.5)).toBe(false);
    expect(isValidIsoAmount("49")).toBe(false);
    const neg = validateCountryPriceEntry({ country: "US", monthly: -5, annual: 50 });
    expect(!neg.ok).toBe(true);
    const frac = validateCountryPriceEntry({ country: "US", monthly: 8.9, annual: 89 });
    expect(!frac.ok).toBe(true);
  });

  it("rejects duplicate countries within one payload", () => {
    const v = validateCountryPriceEntries([
      { country: "GB", monthly: 59, annual: 590 },
      { country: "GB", monthly: 69, annual: 690 },
    ]);
    expect(!v.ok && v.error).toMatch(/duplicate country GB/);
  });

  it("covers all 16 seed markets", () => {
    expect(SEED_COUNTRIES.length).toBe(16);
    for (const c of SEED_COUNTRIES) {
      expect(validateCountryPriceEntry({ country: c.code, monthly: 1, annual: 10 }).ok).toBe(true);
    }
  });
});

describe("splitting country prices from plan patches", () => {
  it("separates countryPrices from plan fields", () => {
    const r = splitCountryPrices({
      monthlyPrice: 9900,
      tagline: "New",
      countryPrices: [{ country: "IN", monthly: 2499, annual: 24990 }],
    });
    expect(r.planPatch).toEqual({ monthlyPrice: 9900, tagline: "New" });
    expect(r.countryPrices?.[0]).toMatchObject({ country: "IN", currency: "INR" });
  });

  it("propagates validation errors without plan fields", () => {
    const r = splitCountryPrices({ countryPrices: [{ country: "Mars", monthly: 1, annual: 1 }] });
    expect(r.planPatch).toEqual({});
    expect(r.error).toMatch(/unknown country/i);
  });

  it("passes plain plan patches through untouched", () => {
    const r = splitCountryPrices({ annualPrice: 99000 });
    expect(r.planPatch).toEqual({ annualPrice: 99000 });
    expect(r.countryPrices).toBeUndefined();
  });
});
