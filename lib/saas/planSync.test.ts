import { describe, it, expect } from "vitest";
import {
  PROPOSABLE_FIELDS,
  REQUEST_ACTIONS,
  planSnapshot,
  pickProposable,
  mergeProposal,
  diffSnapshots,
  patchFromDiff,
  isStaleRequest,
  isSuperTier,
  selfApprovalError,
  baselineMatches,
} from "./planSync";
import {
  buildCatalogPlanInputs,
  looksLikeCentContamination,
  type PricingPlanSyncAudit,
} from "./planCatalog";
import { hasSaasPerm } from "./roles";
import {
  coerceApprovalRequirement,
  defaultApprovalRequirement,
  SETTING_REQUIRE_MARKETING_PRICING_APPROVAL,
} from "./settings";
import { hasCapability } from "@/lib/marketing/roles";
import { PLANS } from "@/lib/pricing/catalog";

const basePlan: Record<string, unknown> = {
  id: "p1",
  slug: "starter",
  name: "Starter",
  marketingPlanId: "starter",
  monthlyPrice: 8900,
  annualPrice: 89000,
  currency: "USD",
  trialDays: 14,
  maxProperties: null,
  maxUsers: null,
  maxBookings: null,
  storageGb: null,
  features: { cardFeatures: ["A", "B"] },
  isActive: true,
  description: null,
  tagline: "For small hotels & growing guesthouses",
  descriptor: "Best for growing properties",
  roomMin: 7,
  roomMax: 15,
  adminLimit: 2,
  staffLimit: 10,
  featured: false,
  displayOrder: 1,
  isCustomPrice: false,
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
  it("covers the full commercial structure but never financial-foreign fields", () => {
    for (const f of [
      "name", "slug", "monthlyPrice", "annualPrice", "trialDays", "roomMin", "roomMax",
      "adminLimit", "staffLimit", "featured", "displayOrder", "isCustomPrice", "isActive",
    ]) {
      expect(PROPOSABLE_FIELDS).toContain(f);
    }
    const dirty = { ...basePlan, id: "other", amount: 999999, createdAt: "2020" } as Record<string, unknown>;
    const clean = pickProposable(dirty) as Record<string, unknown>;
    expect(Object.keys(clean).every((k) => (PROPOSABLE_FIELDS as readonly string[]).includes(k))).toBe(true);
    expect(clean.id).toBeUndefined();
    expect(clean.amount).toBeUndefined();
  });
});

describe("snapshot / diff / apply roundtrip", () => {
  it("captures only whitelisted fields in snapshots", () => {
    const snap = planSnapshot(basePlan) as unknown as Record<string, unknown>;
    expect(snap.monthlyPrice).toBe(8900);
    expect(snap.roomMin).toBe(7);
    expect(snap.id).toBeUndefined(); // identity fields never snapshot
  });

  it("merges proposals onto snapshots and diffs them — including structural fields", () => {
    const before = planSnapshot(basePlan);
    const after = mergeProposal(before, { monthlyPrice: 9900, adminLimit: 3, featured: true });
    const diff = diffSnapshots(before, after);
    expect(diff.map((d) => d.field).sort()).toEqual(["adminLimit", "featured", "monthlyPrice"]);
    expect(diff.find((d) => d.field === "monthlyPrice")).toMatchObject({ before: 8900, after: 9900 });
    expect(after.name).toBe("Starter"); // untouched fields survive
  });

  it("patchFromDiff emits only whitelisted keys (financial integrity)", () => {
    const before = planSnapshot(basePlan);
    const after = mergeProposal(before, {
      annualPrice: 99000,
      staffLimit: 20,
      features: { cardFeatures: ["A"] },
    });
    const patch = patchFromDiff(before, after) as Record<string, unknown>;
    for (const key of Object.keys(patch)) {
      expect(PROPOSABLE_FIELDS).toContain(key);
    }
    // A price/limits change can never mutate invoices/payments — different
    // tables, enforced structurally because the patch contains nothing else.
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

describe("tier helpers + security matrix", () => {
  it("recognizes the super tier via SYSTEM_SETTINGS_MANAGE", () => {
    expect(isSuperTier(superUser)).toBe(true);
    expect(isSuperTier(platformAdmin)).toBe(true);
    expect(isSuperTier(marketingUser)).toBe(false);
    expect(hasSaasPerm(marketingUser, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    expect(hasSaasPerm(platformAdmin, "PLAN_MANAGE")).toBe(true);
  });
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

describe("catalog-derived canonical inputs (Marketing authority)", () => {
  it("represents every Marketing commercial plan with full structure", () => {
    const inputs = buildCatalogPlanInputs();
    expect(inputs.map((i) => i.slug)).toEqual(PLANS.map((p) => p.id));
    for (const i of inputs) {
      expect(i.marketingPlanId).toBe(i.slug);
      expect(i.tagline).toBeTruthy();
      expect(typeof i.displayOrder).toBe("number");
      expect(Array.isArray((i.features as { cardFeatures?: string[] }).cardFeatures)).toBe(true);
    }
  });

  it("derives billing cents from the US storefront baseline ×100", () => {
    const inputs = Object.fromEntries(buildCatalogPlanInputs().map((i) => [i.slug, i]));
    expect(inputs.solopreneur.monthlyPrice).toBe(4900); // $49 → 4900¢
    expect(inputs.starter.monthlyPrice).toBe(8900); // $89 → 8900¢
    expect(inputs.growth.monthlyPrice).toBe(17900);
    expect(inputs.professional.monthlyPrice).toBe(29900);
  });

  it("marks Enterprise as contact-sales custom pricing", () => {
    const ent = buildCatalogPlanInputs().find((i) => i.slug === "enterprise");
    expect(ent?.isCustomPrice).toBe(true);
    expect(ent?.monthlyPrice).toBe(0);
    expect(ent?.adminLimit).toBeNull();
    expect(ent?.staffLimit).toBeNull();
    const others = buildCatalogPlanInputs().filter((i) => i.slug !== "enterprise");
    expect(others.every((i) => !i.isCustomPrice)).toBe(true);
  });

  it("flags growth as the featured plan and orders by catalog position", () => {
    const inputs = buildCatalogPlanInputs();
    expect(inputs.find((i) => i.featured)?.slug).toBe("growth");
    expect(inputs.map((i) => i.displayOrder)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("cent contamination detection (storefront unit repair)", () => {
  it("detects leaked billing cents in US storefront cells", () => {
    expect(looksLikeCentContamination({ monthly: 4900, annual: 44000 }, "starter")).toBe(true); // prod corruption
    expect(looksLikeCentContamination({ monthly: 3600, annual: 49000 }, "starter")).toBe(true); // local corruption
    expect(looksLikeCentContamination({ monthly: 9900, annual: 99000 }, "professional")).toBe(true);
    expect(looksLikeCentContamination({ monthly: 89, annual: 890 }, "starter")).toBe(false); // healthy
    expect(looksLikeCentContamination({ monthly: 299, annual: 2990 }, "professional")).toBe(false);
    expect(looksLikeCentContamination(undefined, "starter")).toBe(false);
    expect(looksLikeCentContamination({ monthly: 0, annual: 0 }, "enterprise")).toBe(false); // custom has no truth
  });
});

describe("baseline invariant (billing cents ↔ storefront units)", () => {
  it("matches when US units ×100 equal billing cents", () => {
    expect(baselineMatches({ monthly: 89, annual: 890 }, { monthlyPrice: 8900, annualPrice: 89000 })).toBe(true);
    expect(baselineMatches({ monthly: 49, annual: 490 }, { monthlyPrice: 4900, annualPrice: 49000 })).toBe(true);
  });
  it("reports drift on any mismatch or missing row", () => {
    expect(baselineMatches({ monthly: 89, annual: 890 }, { monthlyPrice: 4900, annualPrice: 89000 })).toBe(false);
    expect(baselineMatches({ monthly: 4900, annual: 44000 }, { monthlyPrice: 490000, annualPrice: 4400000 })).toBe(true); // contaminated-but-consistent pair is still *consistent*
    expect(baselineMatches(undefined, { monthlyPrice: 100, annualPrice: 1000 })).toBe(false);
  });
});

describe("request actions", () => {
  it("supports structural actions", () => {
    expect(REQUEST_ACTIONS).toContain("create");
    expect(REQUEST_ACTIONS).toContain("archive");
    expect(REQUEST_ACTIONS).toContain("activate");
    expect(REQUEST_ACTIONS).toContain("deactivate");
  });
});

describe("audit shape contract", () => {
  it("exposes every category required by the sync spec", () => {
    const audit: PricingPlanSyncAudit = {
      matched: [], marketingOnly: [], saasOnly: [], priceMismatch: [],
      featureMismatch: [], limitMismatch: [], currencyMismatch: [], countryMismatch: [],
      customPlans: [], ok: true,
    };
    expect(audit).toHaveProperty("matched");
    expect(audit).toHaveProperty("marketingOnly");
    expect(audit).toHaveProperty("saasOnly");
    expect(audit).toHaveProperty("priceMismatch");
    expect(audit).toHaveProperty("featureMismatch");
    expect(audit).toHaveProperty("limitMismatch");
    expect(audit).toHaveProperty("currencyMismatch");
    expect(audit).toHaveProperty("countryMismatch");
    expect(audit).toHaveProperty("customPlans");
  });
});
