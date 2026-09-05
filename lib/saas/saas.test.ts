import { describe, it, expect } from "vitest";
import { validateOrgInput, validateOrgPatch } from "./organizations";
import { validatePropertyInput } from "./properties";
import { hasSaasPerm } from "./roles";
import { validatePlanInput } from "./plans";
import { canTransition, computeMrr, isSubscriptionStatus } from "./subscriptions";
import { getPlanLimit } from "./usage";
import { canTransitionCommission, calcCommissionAmount, COMMISSION_STATUSES } from "./commissions";
import { canTransitionPayout, PAYOUT_STATUSES } from "./payouts";
import { statusForScore } from "./health";
import { nextRetryAfterAttempt, RETRY_SCHEDULE_DAYS } from "./dunning";
import { validateCouponInput, computeDiscount } from "./coupons";
import { canTransitionTicket, slaDueFor, isSlaBreached, TICKET_CATEGORIES } from "./support";
import { canTransitionFranchisee, FRANCHISEE_STATUSES } from "./franchise";
import { PARTNER_STATUSES } from "./partners";

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

describe("saas customer health", () => {
  it("churned is deterministic from subscription status", () => {
    expect(statusForScore(95, "cancelled")).toBe("churned");
    expect(statusForScore(95, "expired")).toBe("churned");
    expect(statusForScore(null, "active")).toBe("stable");
  });
  it("maps scores to bands", () => {
    expect(statusForScore(90, "active")).toBe("healthy");
    expect(statusForScore(70, "active")).toBe("stable");
    expect(statusForScore(50, "active")).toBe("at_risk");
    expect(statusForScore(20, "active")).toBe("critical");
  });
});

describe("saas dunning schedule", () => {
  it("uses 1/3/5/7 day retry ladder", () => {
    expect(RETRY_SCHEDULE_DAYS).toEqual([1, 3, 5, 7]);
    const base = new Date("2026-01-01T00:00:00Z");
    expect(nextRetryAfterAttempt(1, base)).toEqual(new Date("2026-01-02T00:00:00Z"));
    expect(nextRetryAfterAttempt(2, base)).toEqual(new Date("2026-01-04T00:00:00Z"));
    expect(nextRetryAfterAttempt(4, base)).toEqual(new Date("2026-01-08T00:00:00Z"));
  });
  it("returns null after final attempt", () => {
    expect(nextRetryAfterAttempt(4 + 1)).toBeNull();
    expect(nextRetryAfterAttempt(99)).toBeNull();
  });
});

describe("saas coupons", () => {
  it("validates coupon input", () => {
    expect(validateCouponInput({ type: "percent", value: 2000, duration: "once" }).ok).toBe(true);
    expect(validateCouponInput({ type: "bogus" as never, value: 100, duration: "once" }).ok).toBe(false);
    expect(validateCouponInput({ type: "percent", value: 20000, duration: "once" }).ok).toBe(false); // >100%
    expect(validateCouponInput({ type: "fixed", value: -5, duration: "once" }).ok).toBe(false);
    expect(validateCouponInput({ type: "percent", value: 1000 }).ok).toBe(false); // missing duration
    expect(validateCouponInput({ type: "percent", value: 1000, duration: "repeating" }).ok).toBe(false); // missing months
    expect(validateCouponInput({ type: "percent", value: 1000, duration: "repeating", months: 40 }).ok).toBe(false);
    expect(validateCouponInput({ type: "percent", value: 1000, duration: "repeating", months: 12 }).ok).toBe(true);
  });
  it("computes discounts correctly and never exceeds amount", () => {
    expect(computeDiscount("percent", 2000, 9900)).toBe(1980); // 20% of $99
    expect(computeDiscount("fixed", 5000, 9900)).toBe(5000); // $50 off
    expect(computeDiscount("fixed", 50000, 9900)).toBe(9900); // capped at amount
    expect(computeDiscount("percent", 10000, 9900)).toBe(9900); // 100%
  });
});

describe("saas support tickets", () => {
  it("has a fixed category list", () => {
    expect(TICKET_CATEGORIES).toContain("billing");
    expect(TICKET_CATEGORIES).toContain("bug");
    expect(TICKET_CATEGORIES).not.toContain("bogus");
  });
  it("enforces ticket status transitions incl. reopen path", () => {
    expect(canTransitionTicket("open", "in_progress")).toBe(true);
    expect(canTransitionTicket("open", "resolved")).toBe(true);
    expect(canTransitionTicket("pending", "in_progress")).toBe(true);
    expect(canTransitionTicket("in_progress", "resolved")).toBe(true);
    expect(canTransitionTicket("resolved", "closed")).toBe(true);
    expect(canTransitionTicket("resolved", "in_progress")).toBe(true); // reopen
    expect(canTransitionTicket("closed", "open")).toBe(false); // terminal
    expect(canTransitionTicket("closed", "in_progress")).toBe(false);
    expect(canTransitionTicket("open", "bogus" as never)).toBe(false);
  });
  it("computes SLA due dates by priority", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(slaDueFor("urgent", base)).toEqual(new Date("2026-01-01T04:00:00Z"));
    expect(slaDueFor("high", base)).toEqual(new Date("2026-01-01T08:00:00Z"));
    expect(slaDueFor("medium", base)).toEqual(new Date("2026-01-02T00:00:00Z"));
    expect(slaDueFor("low", base)).toEqual(new Date("2026-01-04T00:00:00Z"));
  });
  it("flags SLA breaches deterministically", () => {
    const overdue = { status: "open", slaDueAt: new Date(Date.now() - 60000), resolvedAt: null, firstResponseAt: null };
    const withinSla = { status: "open", slaDueAt: new Date(Date.now() + 3600000), resolvedAt: null, firstResponseAt: null };
    expect(isSlaBreached(overdue)).toBe(true);
    expect(isSlaBreached(withinSla)).toBe(false);
    expect(isSlaBreached({ ...overdue, resolvedAt: new Date() })).toBe(false); // resolved in time
    expect(isSlaBreached({ ...overdue, status: "closed" })).toBe(false);
    expect(isSlaBreached({ status: "open", slaDueAt: null, resolvedAt: null, firstResponseAt: null })).toBe(false);
  });
});

describe("saas partners & franchise", () => {
  it("partner lifecycle statuses are well-formed", () => {
    for (const s of ["applied", "review", "approved", "active", "suspended"]) expect(PARTNER_STATUSES).toContain(s as never);
    expect(PARTNER_STATUSES).not.toContain("bogus" as never);
  });
  it("enforces franchisee agreement transitions", () => {
    expect(FRANCHISEE_STATUSES).toContain("proposed");
    expect(canTransitionFranchisee("proposed", "signed")).toBe(true);
    expect(canTransitionFranchisee("signed", "active")).toBe(true);
    expect(canTransitionFranchisee("active", "terminated")).toBe(true);
    expect(canTransitionFranchisee("proposed", "active")).toBe(false);
    expect(canTransitionFranchisee("terminated", "active")).toBe(false);
    expect(canTransitionFranchisee("active", "active")).toBe(false);
  });
});
