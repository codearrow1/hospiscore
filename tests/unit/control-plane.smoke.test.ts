import { describe, it, expect } from "vitest";

describe("Control Plane Smoke Tests", () => {
  it("initSaasDb completes without throwing", async () => {
    const { initSaasDb } = await import("@/lib/saas/init");
    await expect(initSaasDb()).resolves.toBeUndefined();
  });

  it("saasMetrics returns a valid structure", async () => {
    const { saasMetrics } = await import("@/lib/saas/metrics");
    const m = await saasMetrics(30);
    expect(m).toHaveProperty("mrr");
    expect(m).toHaveProperty("arr");
    expect(m).toHaveProperty("activeCustomers");
    expect(m).toHaveProperty("totalCustomers");
    expect(m).toHaveProperty("mrrGrowth");
    expect(Array.isArray(m.mrrGrowth)).toBe(true);
    expect(m).toHaveProperty("revenueByPlan");
    expect(Array.isArray(m.revenueByPlan)).toBe(true);
    expect(m).toHaveProperty("funnel");
    expect(Array.isArray(m.funnel)).toBe(true);
    expect(typeof m.mrr).toBe("number");
    expect(typeof m.arr).toBe("number");
  });

  it("saasOpsSummary returns a valid structure", async () => {
    const { saasOpsSummary } = await import("@/lib/saas/metrics");
    const ops = await saasOpsSummary();
    expect(typeof ops.outstandingArCents).toBe("number");
    expect(typeof ops.openInvoiceCount).toBe("number");
    expect(typeof ops.overdueInvoiceCount).toBe("number");
    expect(typeof ops.dunningActiveCount).toBe("number");
    expect(typeof ops.slaBreachedCount).toBe("number");
    expect(typeof ops.pendingApprovalCount).toBe("number");
  });

  it("listHealth returns items array", async () => {
    const { listHealth } = await import("@/lib/saas/health");
    const h = await listHealth({});
    expect(h).toHaveProperty("items");
    expect(Array.isArray(h.items)).toBe(true);
  });

  it("revenueByCountry returns an array", async () => {
    const { revenueByCountry } = await import("@/lib/saas/analytics");
    const r = await revenueByCountry();
    expect(Array.isArray(r)).toBe(true);
    if (r.length > 0) {
      expect(r[0]).toHaveProperty("key");
      expect(r[0]).toHaveProperty("customers");
      expect(r[0]).toHaveProperty("mrr");
    }
  });

  it("churnCohort returns an array of month entries", async () => {
    const { churnCohort } = await import("@/lib/saas/analytics");
    const c = await churnCohort(6);
    expect(Array.isArray(c)).toBe(true);
    if (c.length > 0) {
      expect(c[0]).toHaveProperty("month");
      expect(c[0]).toHaveProperty("lost");
      expect(c[0]).toHaveProperty("lostMrr");
    }
  });

});
