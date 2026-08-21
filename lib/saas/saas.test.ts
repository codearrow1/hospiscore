import { describe, it, expect } from "vitest";
import { validateOrgInput, validateOrgPatch } from "./organizations";
import { validatePropertyInput } from "./properties";
import { hasSaasPerm } from "./roles";
import { validatePlanInput } from "./plans";
import { canTransition, computeMrr, isSubscriptionStatus } from "./subscriptions";
import { getPlanLimit } from "./usage";
import { canTransitionCommission, calcCommissionAmount, COMMISSION_STATUSES } from "./commissions";
import { canTransitionPayout, PAYOUT_STATUSES } from "./payouts";

describe("saas organizations validation", () => {
  it("rejects short legalName", () => {
    expect(validateOrgInput({ legalName: "A" }).ok).toBe(false);
    expect(validateOrgInput({ legalName: "AB" }).ok).toBe(true);
  });
  it("rejects bad country", () => {
    expect(validateOrgInput({ legalName: "Test Org", country: "USA" }).ok).toBe(false);
    expect(validateOrgInput({ legalName: "Test Org", country: "US" }).ok).toBe(true);
    expect(validateOrgInput({ legalName: "Test Org", country: "IN" }).ok).toBe(true);
  });
  it("rejects invalid contact email", () => {
    expect(validateOrgInput({ legalName: "Test", primaryContact: { name: "A", email: "bad" } }).ok).toBe(false);
    expect(validateOrgInput({ legalName: "Test", primaryContact: { name: "A", email: "a@b.com" } }).ok).toBe(true);
  });
  it("validates patch status", () => {
    expect(validateOrgPatch({ status: "active" }).ok).toBe(true);
    expect(validateOrgPatch({ status: "bogus" as never }).ok).toBe(false);
    expect(validateOrgPatch({ healthScore: 101 }).ok).toBe(false);
    expect(validateOrgPatch({ healthScore: 50 }).ok).toBe(true);
  });
});

describe("saas properties validation", () => {
  it("requires name", () => {
    expect(validatePropertyInput({ name: "" }).ok).toBe(false);
    expect(validatePropertyInput({ name: "My Hotel" }).ok).toBe(true);
  });
  it("validates country and rooms", () => {
    expect(validatePropertyInput({ name: "AB", country: "USA" }).ok).toBe(false);
    expect(validatePropertyInput({ name: "AB", rooms: -1 }).ok).toBe(false);
    expect(validatePropertyInput({ name: "AB", rooms: 50 }).ok).toBe(true);
  });
});

describe("saas RBAC", () => {
  it("super_admin has all saas perms", () => {
    expect(hasSaasPerm({ email: "a@x.com", role: "super_admin" }, "CUSTOMER_MANAGE")).toBe(true);
    expect(hasSaasPerm({ email: "a@x.com", role: "super_admin" }, "BILLING_MANAGE")).toBe(true);
    expect(hasSaasPerm({ email: "a@x.com", role: "super_admin" }, "AUDIT_VIEW")).toBe(true);
  });
  it("sales_rep can view but not manage customers", () => {
    expect(hasSaasPerm({ email: "a@x.com", role: "sales_rep" }, "CUSTOMER_VIEW")).toBe(true);
    expect(hasSaasPerm({ email: "a@x.com", role: "sales_rep" }, "CUSTOMER_MANAGE")).toBe(false);
    expect(hasSaasPerm({ email: "a@x.com", role: "sales_rep" }, "BILLING_MANAGE")).toBe(false);
  });
  it("analyst is read-only", () => {
    expect(hasSaasPerm({ email: "a@x.com", role: "analyst" }, "CUSTOMER_VIEW")).toBe(true);
    expect(hasSaasPerm({ email: "a@x.com", role: "analyst" }, "CUSTOMER_MANAGE")).toBe(false);
  });
  it("no role = no access", () => {
    expect(hasSaasPerm({ email: "a@x.com", role: "" }, "CUSTOMER_VIEW")).toBe(false);
  });
});

describe("saas plans validation", () => {
  it("rejects short name and bad slug", () => {
    expect(validatePlanInput({ name: "A", slug: "a", monthlyPrice: 0, annualPrice: 0 }).ok).toBe(false);
    expect(validatePlanInput({ name: "Pro", slug: "Pro Plan", monthlyPrice: 0, annualPrice: 0 }).ok).toBe(false);
    expect(validatePlanInput({ name: "Pro", slug: "pro", monthlyPrice: -1, annualPrice: 0 }).ok).toBe(false);
    expect(validatePlanInput({ name: "Pro", slug: "pro", monthlyPrice: 9900, annualPrice: 99000 }).ok).toBe(true);
  });
  it("validates trialDays and currency", () => {
    expect(validatePlanInput({ name: "Pro", slug: "pro", monthlyPrice: 0, annualPrice: 0, trialDays: 400 }).ok).toBe(false);
    expect(validatePlanInput({ name: "Pro", slug: "pro", monthlyPrice: 0, annualPrice: 0, currency: "US" }).ok).toBe(false);
    expect(validatePlanInput({ name: "Pro", slug: "pro", monthlyPrice: 0, annualPrice: 0, currency: "USD" }).ok).toBe(true);
  });
});

describe("saas subscriptions", () => {
  it("validates status", () => {
    expect(isSubscriptionStatus("trial")).toBe(true);
    expect(isSubscriptionStatus("bogus")).toBe(false);
  });
  it("enforces allowed transitions", () => {
    expect(canTransition("trial", "active")).toBe(true);
    expect(canTransition("trial", "suspended")).toBe(false);
    expect(canTransition("active", "past_due")).toBe(true);
    expect(canTransition("active", "trial")).toBe(false);
    expect(canTransition("cancelled", "active")).toBe(false);
    expect(canTransition("paused", "active")).toBe(true);
    expect(canTransition("expired", "active")).toBe(false);
  });
  it("computes MRR correctly", () => {
    expect(computeMrr({ monthlyPrice: 9900, annualPrice: 99000 }, "monthly")).toBe(9900);
    expect(computeMrr({ monthlyPrice: 9900, annualPrice: 99000 }, "yearly")).toBe(8250);
  });
});

describe("saas usage", () => {
  it("resolves plan limits", () => {
    expect(getPlanLimit({ maxProperties: 5, maxUsers: 10, maxBookings: null, storageGb: 20 } as never, "properties")).toBe(5);
    expect(getPlanLimit({ maxProperties: null } as never, "properties")).toBeNull();
    expect(getPlanLimit({ storageGb: 20 } as never, "storage")).toBe(20480);
    expect(getPlanLimit({ maxProperties: 1 } as never, "api_calls")).toBeNull();
  });
});

describe("saas commissions", () => {
  it("has valid status set", () => {
    expect(COMMISSION_STATUSES).toContain("pending");
    expect(COMMISSION_STATUSES).toContain("reversed");
    expect(COMMISSION_STATUSES).not.toContain("bogus");
  });
  it("enforces allowed transitions", () => {
    expect(canTransitionCommission("pending", "eligible")).toBe(true);
    expect(canTransitionCommission("pending", "paid")).toBe(false);
    expect(canTransitionCommission("payable", "paid")).toBe(true);
    expect(canTransitionCommission("paid", "reversed")).toBe(true); // chargeback policy
    expect(canTransitionCommission("rejected", "pending")).toBe(false);
    expect(canTransitionCommission("fraud_hold", "rejected")).toBe(true);
    expect(canTransitionCommission("fraud_hold", "paid")).toBe(false);
  });
  it("calculates amounts by model", () => {
    // fixed: value is cents
    expect(calcCommissionAmount("fixed", 5000, 9900)).toBe(5000);
    // percent_first: bps of first invoice (mrr for monthly)
    expect(calcCommissionAmount("percent_first", 2000, 9900)).toBe(1980);
    // percent_mrr_12: bps of 12 months of mrr
    expect(calcCommissionAmount("percent_mrr_12", 2000, 9900)).toBe(23760);
    // percent_mrr_recurring: bps of one month; caller aggregates over time
    expect(calcCommissionAmount("percent_mrr_recurring", 1000, 10000)).toBe(1000);
  });
});

describe("saas payouts", () => {
  it("has valid status set", () => {
    expect(PAYOUT_STATUSES).toContain("requested");
    expect(PAYOUT_STATUSES).toContain("paid");
    expect(PAYOUT_STATUSES).not.toContain("bogus");
  });
  it("enforces allowed transitions", () => {
    expect(canTransitionPayout("requested", "approved")).toBe(true);
    expect(canTransitionPayout("approved", "processing")).toBe(true);
    expect(canTransitionPayout("processing", "paid")).toBe(true);
    expect(canTransitionPayout("processing", "failed")).toBe(true);
    expect(canTransitionPayout("requested", "paid")).toBe(false);
    expect(canTransitionPayout("paid", "failed")).toBe(false);
    expect(canTransitionPayout("failed", "requested")).toBe(true);
  });
});
