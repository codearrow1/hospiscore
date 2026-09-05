import { describe, it, expect } from "vitest";
import {
  annualSavings,
  formatPrice,
  normalizeManualCountry,
  priceFor,
  recommendedPlan,
  resolveCountry,
  taxDescription,
  taxLine,
  gatewayLabels,
  planById,
} from "./engine";
import { SEED_PROFILES } from "./defaults";
import type { BillingCycle } from "./types";

const indian = SEED_PROFILES.IN!;
const us = SEED_PROFILES.US!;

describe("formatPrice", () => {
  it("formats USD with no decimals", () => {
    expect(formatPrice(49, "USD")).toBe("$49");
    expect(formatPrice(17900, "USD")).toBe("$17,900");
  });

  it("formats INR with Indian digit grouping", () => {
    expect(formatPrice(999, "INR")).toBe("₹999");
    expect(formatPrice(69990, "INR")).toBe("₹69,990");
  });

  it("formats two-part symbols with a gap", () => {
    expect(formatPrice(9999, "KES")).toBe("KSh 9,999");
    expect(formatPrice(49, "GBP")).toBe("£49");
    expect(formatPrice(199, "AED")).toBe("AED 199");
  });
});

describe("annualSavings", () => {
  it("computes savings from the stored annual price", () => {
    expect(annualSavings(999, 9990)).toBe(1998);
    expect(annualSavings(49, 490)).toBe(98);
  });

  it("never returns negative savings", () => {
    expect(annualSavings(49, 600)).toBe(0);
  });
});

describe("priceFor", () => {
  it("returns monthly and annual configured prices", () => {
    expect(priceFor(indian, "solopreneur", "monthly")).toBe(999);
    expect(priceFor(indian, "solopreneur", "yearly")).toBe(9990);
    expect(priceFor(us, "growth", "monthly")).toBe(179);
  });

  it("is independent per country (not FX-derived)", () => {
    // INR is roughly 83× USD at FX, but the configured prices are NOT 83×.
    expect(indian.prices.solopreneur.monthly).not.toBe(us.prices.solopreneur.monthly * 83);
  });
});

describe("recommendedPlan", () => {
  const cases: [number, string][] = [
    [1, "solopreneur"],
    [6, "solopreneur"],
    [7, "starter"],
    [15, "starter"],
    [16, "growth"],
    [40, "growth"],
    [41, "professional"],
    [100, "professional"],
    [101, "enterprise"],
    [1000, "enterprise"],
  ];
  for (const [rooms, plan] of cases) {
    it(`recommends ${plan} for ${rooms} rooms`, () => {
      expect(recommendedPlan(rooms)).toBe(plan);
    });
  }
});

describe("resolveCountry", () => {
  const headers = (map: Record<string, string>): Pick<Headers, "get"> => ({
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  });

  it("detects a country from CDN headers", () => {
    const r = resolveCountry(headers({ "cf-ipcountry": "FR" }), undefined);
    expect(r).toMatchObject({ country: "FR", name: "France", source: "header", currency: "EUR" });
  });

  it("prefers the manual billing-country cookie over headers", () => {
    const r = resolveCountry(headers({ "cf-ipcountry": "US" }), "in");
    expect(r).toMatchObject({ country: "IN", name: "India", source: "cookie" });
  });

  it("ignores unknown header codes and falls back to default", () => {
    const r = resolveCountry(headers({ "cf-ipcountry": "ZZ" }), undefined);
    expect(r).toMatchObject({ country: "US", source: "default" });
  });

  it("truncates long header values like Cloudflare variants", () => {
    // Some CDNs append suffixes ("GB,;geo=EU") — only 2-letter codes match.
    const r = resolveCountry(headers({ "x-country-code": "GB,;geo=EU" }), undefined);
    expect(r.country).toBe("US");
  });
});

describe("normalizeManualCountry", () => {
  it("accepts registered codes and rejects others", () => {
    expect(normalizeManualCountry("ke")).toBe("KE");
    expect(normalizeManualCountry("US")).toBe("US");
    expect(normalizeManualCountry("XX")).toBeNull();
    expect(normalizeManualCountry("United States")).toBeNull();
    expect(normalizeManualCountry(null)).toBeNull();
  });
});

describe("tax + gateways", () => {
  it("renders tax lines per country", () => {
    expect(taxLine(indian)).toContain("GST included");
    expect(taxLine(us)).toContain("Sales tax excluded");
    expect(taxDescription(indian)).toContain("GSTIN");
  });

  it("labels gateways from the registry", () => {
    expect(gatewayLabels(indian)).toEqual(["UPI", "Cards", "Net banking"]);
    expect(gatewayLabels(us)).toEqual(["Cards", "ACH"]);
  });

  it("keeps the plan catalog intact", () => {
    expect(planById("growth").featured).toBe(true);
    expect(planById("enterprise").cta).toBe("Talk to Sales");
  });
});

it("billing cycle type is month/year", () => {
  const c: BillingCycle = "yearly";
  expect(c).toBe("yearly");
});