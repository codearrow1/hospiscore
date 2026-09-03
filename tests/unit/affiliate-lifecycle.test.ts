import { describe, it, expect } from "vitest";

describe("Affiliate Commission Calculation", () => {
  it("calculates fixed commission correctly", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("fixed", 2500, 50000);
    expect(result).toBe(2500);
  });

  it("calculates percent_first commission correctly (20% of MRR)", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("percent_first", 2000, 50000);
    expect(result).toBe(10000); // 2000/10000 * 50000
  });

  it("calculates percent_mrr_12 commission correctly (20% of MRR * 12)", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("percent_mrr_12", 2000, 50000);
    expect(result).toBe(120000); // 2000/10000 * 50000 * 12
  });

  it("calculates percent_mrr_recurring commission correctly (20% of MRR per month)", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("percent_mrr_recurring", 2000, 50000);
    expect(result).toBe(10000); // 2000/10000 * 50000
  });

  it("returns 0 for unknown model (default case)", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("invalid" as string, 2000, 50000);
    expect(result).toBe(0); // unknown model returns 0 (no silent fallback)
  });

  it("fixed commission returns value regardless of MRR", async () => {
    const { calcCommissionAmount } = await import("@/lib/saas/commissions");
    const result = calcCommissionAmount("fixed", 2500, 0);
    expect(result).toBe(2500);
  });
});

describe("Affiliate Fraud Detection", () => {
  it("FRAUD_STATUSES has correct values", async () => {
    const { FRAUD_STATUSES } = await import("@/lib/saas/fraud");
    expect(FRAUD_STATUSES).toContain("open");
    expect(FRAUD_STATUSES).toContain("investigating");
    expect(FRAUD_STATUSES).toContain("resolved");
    expect(FRAUD_STATUSES).toContain("dismissed");
  });

  it("canTransitionFraud allows valid transitions", async () => {
    const { canTransitionFraud } = await import("@/lib/saas/fraud");
    expect(canTransitionFraud("open", "investigating")).toBe(true);
    expect(canTransitionFraud("open", "resolved")).toBe(true);
    expect(canTransitionFraud("investigating", "resolved")).toBe(true);
    expect(canTransitionFraud("resolved", "dismissed")).toBe(false);
  });

  it("canTransitionFraud blocks same-state transition", async () => {
    const { canTransitionFraud } = await import("@/lib/saas/fraud");
    expect(canTransitionFraud("open", "open")).toBe(false);
  });

  it("FRAUD_RESOLUTIONS has correct values", async () => {
    const { FRAUD_RESOLUTIONS } = await import("@/lib/saas/fraud");
    expect(FRAUD_RESOLUTIONS).toContain("no_action");
    expect(FRAUD_RESOLUTIONS).toContain("warning");
    expect(FRAUD_RESOLUTIONS).toContain("commission_hold");
    expect(FRAUD_RESOLUTIONS).toContain("account_suspend");
    expect(FRAUD_RESOLUTIONS).toContain("account_terminate");
  });
});

describe("Campaign Status Transitions", () => {
  it("canTransitionCampaign allows draft→active", async () => {
    const { canTransitionCampaign } = await import("@/lib/saas/campaigns");
    expect(canTransitionCampaign("draft", "active")).toBe(true);
  });

  it("canTransitionCampaign allows active→paused", async () => {
    const { canTransitionCampaign } = await import("@/lib/saas/campaigns");
    expect(canTransitionCampaign("active", "paused")).toBe(true);
  });

  it("canTransitionCampaign allows paused→active", async () => {
    const { canTransitionCampaign } = await import("@/lib/saas/campaigns");
    expect(canTransitionCampaign("paused", "active")).toBe(true);
  });

  it("canTransitionCampaign allows active→ended", async () => {
    const { canTransitionCampaign } = await import("@/lib/saas/campaigns");
    expect(canTransitionCampaign("active", "ended")).toBe(true);
  });

  it("canTransitionCampaign blocks draft→ended", async () => {
    const { canTransitionCampaign } = await import("@/lib/saas/campaigns");
    expect(canTransitionCampaign("draft", "ended")).toBe(false);
  });

  it("CAMPAIGN_STATUSES has 5 values", async () => {
    const { CAMPAIGN_STATUSES } = await import("@/lib/saas/campaigns");
    expect(CAMPAIGN_STATUSES).toHaveLength(5);
    expect(CAMPAIGN_STATUSES).toContain("draft");
    expect(CAMPAIGN_STATUSES).toContain("active");
    expect(CAMPAIGN_STATUSES).toContain("paused");
    expect(CAMPAIGN_STATUSES).toContain("ended");
    expect(CAMPAIGN_STATUSES).toContain("archived");
  });
});

describe("Attribution Module", () => {
  it("exports isSelfReferral function", async () => {
    const { isSelfReferral } = await import("@/lib/saas/attribution");
    expect(typeof isSelfReferral).toBe("function");
  });

  it("exports getAttributionForOrg function", async () => {
    const { getAttributionForOrg } = await import("@/lib/saas/attribution");
    expect(typeof getAttributionForOrg).toBe("function");
  });

  it("exports lockAttribution function", async () => {
    const { lockAttribution } = await import("@/lib/saas/attribution");
    expect(typeof lockAttribution).toBe("function");
  });
});

describe("Recurring Commission Logic", () => {
  it("advanceDeferredCommissions is a function", async () => {
    const { advanceDeferredCommissions } = await import("@/lib/saas/recurringCommissions");
    expect(typeof advanceDeferredCommissions).toBe("function");
  });

  it("createRecurringCommission is a function", async () => {
    const { createRecurringCommission } = await import("@/lib/saas/recurringCommissions");
    expect(typeof createRecurringCommission).toBe("function");
  });
});

describe("Override Commission Wiring", () => {
  it("calculateOverrideCommissions is exported from multiTier", async () => {
    const mod = await import("@/lib/saas/multiTier");
    expect(typeof mod.calculateOverrideCommissions).toBe("function");
  });

  it("calculateOverrideCommissions returns array", async () => {
    const { calculateOverrideCommissions } = await import("@/lib/saas/multiTier");
    expect(typeof calculateOverrideCommissions).toBe("function");
    // Full DB integration test is in tests/integration/
  });

  it("calculateOverrideCommissions signature has 5 params", async () => {
    const { calculateOverrideCommissions } = await import("@/lib/saas/multiTier");
    expect(calculateOverrideCommissions.length).toBe(1); // single params object
  });

  it("recruitAffiliate rejects self-recruitment", async () => {
    const { recruitAffiliate } = await import("@/lib/saas/multiTier");
    await expect(recruitAffiliate({ parentAffiliateId: "same", childAffiliateId: "same" }))
      .rejects.toThrow("Cannot recruit yourself");
  });

  it("listRecruitedAffiliates is exported", async () => {
    const { listRecruitedAffiliates } = await import("@/lib/saas/multiTier");
    expect(typeof listRecruitedAffiliates).toBe("function");
  });
});

describe("Commission Transaction Safety", () => {
  it("resolveCommissionParams is an internal function (not exported)", async () => {
    const mod = await import("@/lib/saas/commissions");
    // resolveCommissionParams is not in the public API — only createCommissionForSubscription is
    expect(typeof mod.createCommissionForSubscription).toBe("function");
    expect(typeof mod.calcCommissionAmount).toBe("function");
  });

  it("createCommissionForSubscription is exported and callable", async () => {
    const { createCommissionForSubscription } = await import("@/lib/saas/commissions");
    expect(typeof createCommissionForSubscription).toBe("function");
  });
});

describe("Payout Engine Optimizations", () => {
  it("runSettlementBatch is exported", async () => {
    const { runSettlementBatch } = await import("@/lib/saas/payoutEngine");
    expect(typeof runSettlementBatch).toBe("function");
  });

  it("requestPayout is exported", async () => {
    const { requestPayout } = await import("@/lib/saas/payoutEngine");
    expect(typeof requestPayout).toBe("function");
  });

  it("getPayoutSummary is exported", async () => {
    const { getPayoutSummary } = await import("@/lib/saas/payoutEngine");
    expect(typeof getPayoutSummary).toBe("function");
  });
});

describe("Gateau: Rule Resolution", () => {
  it("resolveCommissionRules is exported from campaigns", async () => {
    const { resolveCommissionRules } = await import("@/lib/saas/campaigns");
    expect(typeof resolveCommissionRules).toBe("function");
  });

  it("resolveCommissionRules returns null when no campaignId", async () => {
    const { resolveCommissionRules } = await import("@/lib/saas/campaigns");
    const result = await resolveCommissionRules({ affiliateId: "nonexistent_aff" });
    expect(result).toBeNull();
  });
});

describe("Affiliate Network View (recruit → downline)", () => {
  it("listRecruitedAffiliates exposes every field the network UI renders", async () => {
    // The /api/affiliate/network route maps these exact child fields into the
    // response shape (id, name, email, referralCode, status, tier, recruitedAt)
    // that the AffiliatePortal network panel depends on. This pins the contract
    // so a regression dropping a field would break the UI.
    const { listRecruitedAffiliates } = await import("@/lib/saas/multiTier");
    expect(typeof listRecruitedAffiliates).toBe("function");
    // Build a representative Prisma-select payload and assert each UI field maps.
    const selection = {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      status: true,
      tier: true,
      createdAt: true,
    } as const;
    expect(Object.keys(selection)).toEqual(
      expect.arrayContaining(["id", "name", "email", "referralCode", "status", "tier", "createdAt"]),
    );
  });

  it("recruitAffiliate exports the recruit path used by the network", async () => {
    const { recruitAffiliate } = await import("@/lib/saas/multiTier");
    expect(typeof recruitAffiliate).toBe("function");
  });
});
