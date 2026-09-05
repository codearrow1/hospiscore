/**
 * SaaS Entitlements & Feature Flags — Phase E
 * Centralizes feature checks by plan/org/property/country/percentage.
 * Prevents hard-coded `if (plan === "enterprise")` in components.
 */

import { prisma } from "@/lib/prisma";

export type FeatureKey = string;

function hashPct(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 100;
  return h;
}

export async function getPlanLimitForOrg(organizationId: string, metric: string): Promise<number | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptions: { where: { status: { in: ["active","trial","past_due","grace"] } }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const plan = org?.subscriptions[0]?.plan;
  if (!plan) return null;
  switch (metric) {
    case "properties": return plan.maxProperties ?? null;
    case "users": return plan.maxUsers ?? null;
    case "bookings": return plan.maxBookings ?? null;
    case "storage": return plan.storageGb != null ? plan.storageGb * 1024 : null;
    default: return null;
  }
}

export async function isEntitled(organizationId: string, feature: FeatureKey): Promise<boolean> {
  return hasEntitlement(organizationId, feature);
}

export async function hasEntitlement(
  organizationId: string,
  feature: FeatureKey,
  context?: { propertyId?: string; country?: string }
): Promise<boolean> {
  // 1. Check explicit FeatureFlag overrides (highest priority: property > org > plan > country > percentage > global)
  const flags = await prisma.featureFlag.findMany({ where: { key: feature }, orderBy: { createdAt: "desc" } });
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const planId = org?.subscriptions[0]?.planId;
  const orgCountry = org?.country;

  // property-specific
  if (context?.propertyId) {
    const f = flags.find((fl) => fl.propertyId === context.propertyId);
    if (f) return evaluateFlag(f, organizationId, context);
  }
  // org-specific
  const orgFlag = flags.find((fl) => fl.organizationId === organizationId);
  if (orgFlag) return evaluateFlag(orgFlag, organizationId, context);
  // plan-specific
  if (planId) {
    const pf = flags.find((fl) => fl.planId === planId);
    if (pf) return evaluateFlag(pf, organizationId, context);
  }
  // country-specific
  const country = context?.country ?? orgCountry;
  if (country) {
    const cf = flags.find((fl) => fl.country?.toUpperCase() === country.toUpperCase());
    if (cf) return evaluateFlag(cf, organizationId, context);
  }
  // global flag (no scope)
  const global = flags.find((fl) => !fl.organizationId && !fl.planId && !fl.propertyId && !fl.country);
  if (global) return evaluateFlag(global, organizationId, context);

  // 2. Fallback to plan.features
  const plan = org?.subscriptions[0]?.plan;
  if (plan?.features && typeof plan.features === "object") {
    const feats = plan.features as Record<string, unknown>;
    if (feats[feature] === true) return true;
    if (feats[feature] === false) return false;
  }
  return false;
}

function evaluateFlag(flag: { key: string; enabled: boolean; percentage: number | null; isBeta: boolean }, organizationId: string, _context?: unknown): boolean {
  void _context;
  if (flag.percentage != null) {
    const bucket = hashPct(organizationId + flag.key);
    if (bucket >= flag.percentage) return false;
  }
  // isBeta could require additional check, but treat as enabled if flag.enabled
  return flag.enabled;
}

export async function canUseFeature(organizationId: string, feature: FeatureKey, context?: { propertyId?: string; country?: string }): Promise<boolean> {
  return hasEntitlement(organizationId, feature, context);
}

export async function requireEntitlement(organizationId: string, feature: FeatureKey): Promise<void> {
  const ok = await hasEntitlement(organizationId, feature);
  if (!ok) throw new Error(`Feature not entitled: ${feature}`);
}
