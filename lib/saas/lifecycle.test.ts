import { describe, it, expect } from "vitest";
import { classifyLifecycle, PAST_DUE_AFTER_MS, SUSPEND_AFTER_MS, TRIAL_EXPIRY_SKEW_MS } from "./lifecycle";
import { prorationDeltaMinor } from "./subscriptions";
import { coerceUsageRates, usageChargeMinor } from "./usageBilling";

const DAY = 86_400_000;

describe("lifecycle classifyLifecycle (M-06)", () => {
  const periodEnd = new Date(10_000 * DAY);

  it("expires trials only after the skew window", () => {
    const sub = { status: "trial", currentPeriodEnd: null, trialEndsAt: new Date(5_000 * DAY) };
    expect(classifyLifecycle(sub, (5_000 + 1) * DAY)).toBeNull(); // inside skew
    expect(classifyLifecycle(sub, 5_000 * DAY + TRIAL_EXPIRY_SKEW_MS + 1)).toBe("expired");
  });

  it("keeps trials without trialEndsAt alive", () => {
    expect(classifyLifecycle({ status: "trial", currentPeriodEnd: null, trialEndsAt: null }, Date.now())).toBeNull();
  });

  it("moves active to past_due after the grace window", () => {
    const sub = { status: "active", currentPeriodEnd: periodEnd };
    expect(classifyLifecycle(sub, periodEnd.getTime() + PAST_DUE_AFTER_MS)).toBeNull(); // boundary not passed
    expect(classifyLifecycle(sub, periodEnd.getTime() + PAST_DUE_AFTER_MS + 1)).toBe("past_due");
    // Fresh period → untouched
    expect(classifyLifecycle(sub, periodEnd.getTime() - DAY)).toBeNull();
  });

  it("suspends past_due and grace subs after the delinquency window", () => {
    for (const status of ["past_due", "grace"] as const) {
      const sub = { status, currentPeriodEnd: periodEnd };
      expect(classifyLifecycle(sub, periodEnd.getTime() + SUSPEND_AFTER_MS)).toBeNull();
      expect(classifyLifecycle(sub, periodEnd.getTime() + SUSPEND_AFTER_MS + 1)).toBe("suspended");
    }
  });

  it("never touches terminal or unrelated statuses", () => {
    expect(classifyLifecycle({ status: "cancelled", currentPeriodEnd: periodEnd }, Date.now())).toBeNull();
    expect(classifyLifecycle({ status: "expired", currentPeriodEnd: periodEnd }, Date.now())).toBeNull();
    expect(classifyLifecycle({ status: "weird", currentPeriodEnd: periodEnd }, Date.now())).toBeNull();
  });

  it("ignores missing period ends", () => {
    expect(classifyLifecycle({ status: "active", currentPeriodEnd: null }, Date.now())).toBeNull();
  });
});

describe("prorationDeltaMinor (M-04)", () => {
  const start = 0;
  const end = 30 * DAY; // 30-day period

  it("charges full monthly delta when changing on day one", () => {
    // old $20/mo → new $50/mo, entire period remaining
    const d = prorationDeltaMinor({
      oldUnitAmount: 20, newUnitAmount: 50,
      oldCycle: "monthly", newCycle: "monthly",
      periodStartMs: start, periodEndMs: end, nowMs: start,
    });
    expect(d).toBe(Math.round((50 - 20) * 100)); // $30.00
  });

  it("scales linearly by remaining fraction", () => {
    const d = prorationDeltaMinor({
      oldUnitAmount: 0, newUnitAmount: 100,
      oldCycle: "monthly", newCycle: "monthly",
      periodStartMs: start, periodEndMs: end, nowMs: end / 2,
    });
    expect(d).toBe(Math.round(100 * 100 / 2)); // half of $100
  });

  it("returns zero at/after period end", () => {
    const opts = {
      oldUnitAmount: 10, newUnitAmount: 90,
      oldCycle: "monthly" as const, newCycle: "monthly" as const,
      periodStartMs: start, periodEndMs: end,
    };
    expect(prorationDeltaMinor({ ...opts, nowMs: end })).toBe(0);
    expect(prorationDeltaMinor({ ...opts, nowMs: end + DAY })).toBe(0);
  });

  it("handles monthly→yearly via monthly equivalents", () => {
    // yearly 1200 units == 100/mo; switching from 40/mo with whole period left
    const d = prorationDeltaMinor({
      oldUnitAmount: 40, newUnitAmount: 1200,
      oldCycle: "monthly", newCycle: "yearly",
      periodStartMs: start, periodEndMs: end, nowMs: start,
    });
    expect(d).toBe(Math.round((100 - 40) * 100));
  });

  it("is negative on downgrade but callers only invoice positive deltas", () => {
    const d = prorationDeltaMinor({
      oldUnitAmount: 80, newUnitAmount: 40,
      oldCycle: "monthly", newCycle: "monthly",
      periodStartMs: start, periodEndMs: end, nowMs: start,
    });
    expect(d).toBe(-4000);
  });

  it("guards degenerate periods", () => {
    expect(
      prorationDeltaMinor({
        oldUnitAmount: 1, newUnitAmount: 2,
        oldCycle: "monthly", newCycle: "monthly",
        periodStartMs: 100, periodEndMs: 100, nowMs: 100,
      }),
    ).toBe(0);
  });
});

describe("usage billing math (M-08)", () => {
  it("coerceUsageRates keeps only sane numeric entries", () => {
    expect(coerceUsageRates({ api_calls: 2, emails: "5", "bad-key": 1, negative: -3, nan: Number.NaN } as Record<string, unknown>)).toEqual({
      api_calls: 2,
      emails: 5,
    });
    expect(coerceUsageRates(null)).toEqual({});
    expect(coerceUsageRates([1, 2])).toEqual({});
  });

  it("usageChargeMinor rounds and never charges non-positive input", () => {
    expect(usageChargeMinor(1234, 2)).toBe(2468);
    expect(usageChargeMinor(3, 0.5)).toBe(2); // rounding
    expect(usageChargeMinor(0, 5)).toBe(0);
    expect(usageChargeMinor(-5, 5)).toBe(0);
    expect(usageChargeMinor(Number.NaN, 5)).toBe(0);
  });
});
