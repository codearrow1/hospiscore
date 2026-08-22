import { describe, it, expect } from "vitest";
import {
  PROPOSABLE_FIELDS,
  planSnapshot,
  pickProposable,
  mergeProposal,
  diffSnapshots,
  patchFromDiff,
  isStaleRequest,
  isSuperTier,
  selfApprovalError,
  baselineMatches,
  withBaseline,
} from "./planSync";
import { hasSaasPerm } from "./roles";
import {
  coerceApprovalRequirement,
  defaultApprovalRequirement,
  SETTING_REQUIRE_MARKETING_PRICING_APPROVAL,
} from "./settings";
import { hasCapability } from "@/lib/marketing/roles";

const basePlan = {
  id: "p1",
  slug: "starter",
  name: "Starter",
  monthlyPrice: 2900,
  annualPrice: 27900,
  currency: "USD",
  trialDays: 14,
  maxProperties: 2,
  maxUsers: 5,
  maxBookings: 500,
  storageGb: 5,
  features: { core: true },
  isActive: true,
};

const marketingUser = { email: "marketing@hospios.demo", role: "marketing_admin" as const };
const superUser = { email: "superadmin@hospios.demo", role: "super_admin" as const };
const platformAdmin = { email: "platform@hospios.demo", role: "platform_admin" as const };

describe("settings coercion", () => {
  it("defaults to approval required (financial safety)", () => {
    expect(defaultApprovalRequirement()).toBe(true);
    expect(coerceApprovalRequirement(undefined)).toBe(true);
    expect(coerceApprovalRequirement(null)).toBe(true);
    expect(coerceApprovalRequirement({})).toBe(true);
    expect(coerceApprovalRequirement("garbage" as unknown)).toBe(true);
  });
  it("accepts explicit booleans; non-boolean payloads fall back safely", () => {
    expect(coerceApprovalRequirement(true)).toBe(true);
    expect(coerceApprovalRequirement(false)).toBe(false);
    // Callers must extract `.enabled` from stored JSON before coercing.
    expect(coerceApprovalRequirement({ enabled: false })).toBe(true);
  });
  it("exposes a stable setting key", () => {
    expect(SETTING_REQUIRE_MARKETING_PRICING_APPROVAL).toBe("require_marketing_pricing_approval");
  });
});

describe("proposal field whitelist", () => {
  it("never allows slug or financial-foreign fields through", () => {
    const dirty = {
      ...basePlan,
      slug: "hacked",
      id: "other",
      amount: 999999,
      createdAt: "2020-01-01",
      extra: true,
    } as Record<string, unknown>;
    const clean = pickProposable(dirty) as Record<string, unknown>;
    expect(Object.keys(clean).every((k) => PROPOSABLE_FIELDS.includes(k as never))).toBe(true);
    expect(clean.slug).toBeUndefined();
    expect(clean.id).toBeUndefined();
    expect(clean.amount).toBeUndefined();
  });
});

describe("snapshot / diff / apply roundtrip", () => {
  it("captures only whitelisted fields in snapshots", () => {
    const snap = planSnapshot(basePlan) as unknown as Record<string, unknown>;
    expect(snap.monthlyPrice).toBe(2900);
    expect(snap.slug).toBeUndefined();
  });

  it("merges proposals onto snapshots and diffs them", () => {
    const before = planSnapshot(basePlan);
    const after = mergeProposal(before, { monthlyPrice: 3900, trialDays: 0 });
    const diff = diffSnapshots(before, after);
    expect(diff.map((d) => d.field).sort()).toEqual(["monthlyPrice", "trialDays"]);
    expect(diff.find((d) => d.field === "monthlyPrice")).toMatchObject({ before: 2900, after: 3900 });
    expect(after.name).toBe("Starter"); // untouched fields survive
  });

  it("patchFromDiff emits only whitelisted keys (financial integrity)", () => {
    const before = planSnapshot(basePlan);
    const after = mergeProposal(before, { annualPrice: 19900, features: { core: true, sso: true } });
    const patch = patchFromDiff(before, after) as Record<string, unknown>;
    for (const key of Object.keys(patch)) {
      expect(PROPOSABLE_FIELDS).toContain(key);
    }
    // A price change can never mutate invoices/payments — different tables,
    // enforced structurally because the patch contains nothing else.
    expect(Object.keys(patch)).toEqual(expect.arrayContaining(["annualPrice"]));
  });

  it("ignores no-op diffs", () => {
    const snap = planSnapshot(basePlan);
    expect(diffSnapshots(snap, mergeProposal(snap, {})).length).toBe(0);
  });
});

describe("staleness + self-approval guards", () => {
  it("flags stale requests when the plan moved on", () => {
    expect(isStaleRequest(1, 1)).toBe(false);
    expect(isStaleRequest(1, 2)).toBe(true);
  });

  it("blocks self-approval by email identity", () => {
    expect(selfApprovalError(superUser.email, superUser.email)).toMatch(/self-approval/i);
    expect(selfApprovalError("SuperAdmin@Hospios.Demo ", "superadmin@hospios.demo")).toMatch(/self-approval/i);
    expect(selfApprovalError(superUser.email, "someone.else@hospios.demo")).toBeNull();
  });
});

describe("tier helpers", () => {
  it("recognizes the super tier via SYSTEM_SETTINGS_MANAGE", () => {
    expect(isSuperTier(superUser)).toBe(true);
    expect(isSuperTier(platformAdmin)).toBe(true);
    expect(isSuperTier(marketingUser)).toBe(false);
    expect(hasSaasPerm(marketingUser, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    expect(hasSaasPerm(platformAdmin, "PLAN_MANAGE")).toBe(true);
  });
});

describe("security matrix (RBAC merge spec §9/§20/§25)", () => {
  it("marketing admins may propose but never approve their own work", () => {
    expect(hasCapability(marketingUser, "pricing.manage")).toBe(true);
    expect(selfApprovalError(marketingUser.email, marketingUser.email)).toMatch(/self-approval/i);
  });
  it("non-super SaaS roles cannot manage plans or settings", () => {
    for (const role of ["finance_admin", "support_admin", "ops_manager"] as const) {
      expect(hasSaasPerm({ email: `${role}@x`, role }, "PLAN_MANAGE")).toBe(false);
      expect(hasSaasPerm({ email: `${role}@x`, role }, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    }
  });
});

describe("baseline sync invariant (canonical Plan → storefront US profile)", () => {
  const profiles = {
    US: { prices: { starter: { monthly: 2900, annual: 27900 } } },
    IN: { prices: { starter: { monthly: 190000, annual: 1900000 } } },
  };

  it("detects drift between storefront baseline and canonical plan", () => {
    expect(baselineMatches(profiles.US.prices.starter, { monthlyPrice: 2900, annualPrice: 27900 })).toBe(true);
    expect(baselineMatches(profiles.US.prices.starter, { monthlyPrice: 3900, annual: 27900 } as never)).toBe(false);
    expect(baselineMatches(undefined, { monthlyPrice: 2900, annualPrice: 27900 })).toBe(false);
  });

  it("applies plan prices to the baseline profile without touching other countries", () => {
    const next = withBaseline(
      profiles as typeof profiles,
      "US",
      "starter",
      { monthlyPrice: 3900, annualPrice: 39900 },
    );
    expect(next.US.prices.starter).toEqual({ monthly: 3900, annual: 39900 });
    expect(next.IN.prices.starter).toEqual(profiles.IN.prices.starter); // localization preserved
    expect(profiles.US.prices.starter.monthly).toBe(2900); // input not mutated
  });

  it("leaves profiles alone when the catalog entry is missing", () => {
    const next = withBaseline(profiles as typeof profiles, "US", "ghost-plan", {
      monthlyPrice: 100,
      annualPrice: 1000,
    });
    expect(next).toBe(profiles);
  });
});
