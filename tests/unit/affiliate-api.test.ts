import { describe, it, expect } from "vitest";

describe("Affiliate API Formula Logic", () => {
  it("percentage formula: value/10000 * base", () => {
    const value = 2000; // 20%
    const base = 50000;
    const result = Math.round((value / 10000) * base);
    expect(result).toBe(10000);
  });

  it("flat formula: value directly", () => {
    const value = 2500;
    const result = Math.round(value);
    expect(result).toBe(2500);
  });

  it("tiered formula picks correct tier", () => {
    const tiers = [
      { threshold: 0, rate: 1000 },
      { threshold: 50000, rate: 1500 },
      { threshold: 100000, rate: 2000 },
    ];
    const base = 75000;
    const applicable = tiers.filter((t) => base >= t.threshold).pop()!;
    const result = Math.round((applicable.rate / 10000) * base);
    expect(result).toBe(11250); // 15% of 75000
  });

  it("tiered formula with no matching tier returns 0", () => {
    const tiers = [{ threshold: 100000, rate: 2000 }];
    const base = 50000;
    const applicable = tiers.filter((t) => base >= t.threshold).pop();
    expect(applicable).toBeUndefined();
  });

  it("max commission cap works", () => {
    const calculated = 15000;
    const maxCommission = 10000;
    const result = Math.min(calculated, maxCommission);
    expect(result).toBe(10000);
  });

  it("holding period calculation", () => {
    const holdingPeriodDays = 30;
    const now = new Date();
    const holdUntil = new Date(now.getTime() + holdingPeriodDays * 86400000);
    const diffDays = Math.round((holdUntil.getTime() - now.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });

  it("override commission: tier2 is percentage of direct commission", () => {
    const directCommission = 10000;
    const tier2Rate = 1000; // 10%
    const override = Math.round((directCommission * tier2Rate) / 10000);
    expect(override).toBe(1000);
  });

  it("recurring limit check", () => {
    const existingCount = 11;
    const recurringLimit = 12;
    const canGenerate = recurringLimit === null || existingCount < recurringLimit;
    expect(canGenerate).toBe(true);
  });

  it("recurring duration check", () => {
    const recurringDuration: number = 12;
    const monthsElapsed = 13;
    const canGenerate = recurringDuration === -1 || monthsElapsed <= recurringDuration;
    expect(canGenerate).toBe(false);
  });

  it("lifetime recurring (duration -1) always allows", () => {
    const recurringDuration = -1;
    const monthsElapsed = 100;
    const canGenerate = recurringDuration === -1 || monthsElapsed <= recurringDuration;
    expect(canGenerate).toBe(true);
  });

  it("balance calculation: sum of positive commissions minus sum of payouts", () => {
    const commissions = [10000, 5000, -2000, 8000];
    const payouts = [3000, 2000];
    const earned = commissions.filter((c) => c > 0).reduce((a, b) => a + b, 0);
    const paidOut = payouts.reduce((a, b) => a + b, 0);
    const balance = earned - paidOut;
    expect(balance).toBe(18000);
  });

  it("plan override matches correct plan", () => {
    const overrides = [
      { planSlug: "starter", commissionModel: "flat", commissionValue: 1500 },
      { planSlug: "enterprise", commissionModel: "percentage", commissionValue: 2500 },
    ];
    const planSlug = "enterprise";
    const matched = overrides.find((o) => o.planSlug === planSlug);
    expect(matched?.commissionValue).toBe(2500);
  });

  it("country override falls back to campaign default", () => {
    const overrides = [{ country: "US", commissionModel: "flat", commissionValue: 3000 }];
    const country = "UK";
    const matched = overrides.find((o) => o.country === country);
    expect(matched).toBeUndefined();
    const fallback = { commissionModel: "percentage", commissionValue: 2000 };
    expect(fallback.commissionValue).toBe(2000);
  });
});
