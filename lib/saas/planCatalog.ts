/**
 * Plan catalog structure service.
 *
 * The Marketing Admin pricing catalog (lib/pricing/catalog.ts + the PricingDoc
 * data file) is THE commercial authority. This module makes the canonical SaaS
 * `Plan` table represent exactly that structure:
 *
 *   Marketing catalog id  →  Plan.marketingPlanId (stable identity)
 *   Storefront prices     →  PlanCountryPrice rows (local currency units)
 *   Billing price         →  Plan.monthlyPrice/annualPrice (USD cents = US×100)
 *   Commercial metadata   →  dedicated columns + features.cardFeatures[]
 *
 * `auditPricingPlanSync()` reports drift; `reconcilePlans()` fixes it with a
 * dry-run-first action plan (CREATE / UPDATE / MAP / ARCHIVE / REPAIR /
 * CONFLICT). Historical financial rows are never touched: obsolete plans are
 * archived, never deleted.
 */
import { prisma } from "@/lib/prisma";
import { PLANS, PLAN_IDS } from "@/lib/pricing/catalog";
import { getPricingDoc } from "@/lib/pricing/db";
import type { PricingDoc, PricingProfile } from "@/lib/pricing/types";

export interface CountryPriceRow {
  country: string;
  currency: string;
  monthly: number;
  annual: number;
}

// ---------------------------------------------------------------------------
// Pure builders
// ---------------------------------------------------------------------------

/** US baseline seed price for a catalog slug (storefront units). */
function usSeedPrice(slug: string): { monthly: number; annual: number } {
  const entry = PLANS.find((p) => p.id === slug);
  if (!entry) return { monthly: 0, annual: 0 };
  // Seed table values from lib/pricing/defaults.ts (US profile).
  const seeds: Record<string, { monthly: number; annual: number }> = {
    solopreneur: { monthly: 49, annual: 490 },
    starter: { monthly: 89, annual: 890 },
    growth: { monthly: 179, annual: 1790 },
    professional: { monthly: 299, annual: 2990 },
    enterprise: { monthly: 0, annual: 0 },
  };
  void entry;
  return seeds[slug] ?? { monthly: 0, annual: 0 };
}

/**
 * Full canonical PlanInput for every catalog plan. Billing prices are USD
 * cents derived from the US storefront baseline ×100; Enterprise is a
 * contact-sales plan (custom pricing).
 */
export function buildCatalogPlanInputs(): import("@/lib/saas/plans").PlanInput[] {
  return PLANS.map((p, i) => {
    const us = usSeedPrice(p.id);
    const isCustom = p.id === "enterprise" || (us.monthly === 0 && us.annual === 0);
    return {
      name: p.name,
      slug: p.id,
      marketingPlanId: p.id,
      monthlyPrice: us.monthly * 100,
      annualPrice: us.annual * 100,
      currency: "USD",
      trialDays: 14,
      maxProperties: null,
      maxUsers: null,
      maxBookings: null,
      storageGb: null,
      features: { cardFeatures: [...p.cardFeatures] },
      isActive: true,
      tagline: p.tagline,
      descriptor: p.descriptor,
      roomMin: p.roomMin,
      roomMax: p.roomMax ?? null,
      adminLimit: p.adminLimit,
      staffLimit: p.staffLimit,
      featured: !!p.featured,
      displayOrder: i,
      isCustomPrice: isCustom,
    };
  });
}

/** Catalog-derived country price rows for one plan from a PricingDoc. */
export function catalogCountryPrices(
  doc: PricingDoc,
  marketingPlanId: string,
): CountryPriceRow[] {
  const rows: CountryPriceRow[] = [];
  for (const [code, prof] of Object.entries(doc.profiles) as [string, PricingProfile][]) {
    const price = (prof.prices as Record<string, { monthly: number; annual: number }> | undefined)?.[
      marketingPlanId
    ];
    if (!price) continue;
    rows.push({ country: code, currency: prof.currency, monthly: price.monthly, annual: price.annual });
  }
  return rows;
}

/** True when a storefront cell contains leaked billing cents (unit bug). */
export function looksLikeCentContamination(
  unitPrice: { monthly: number; annual: number } | undefined,
  slug: string,
): boolean {
  if (!unitPrice) return false;
  const seed = usSeedPrice(slug);
  if (seed.monthly === 0) return false; // custom plans have no numeric truth
  // Signature of past corruption: value equals cents-scale amounts (≥ $1,000
  // monthly in units) while the seed default is far smaller.
  return unitPrice.monthly >= 1000 && unitPrice.monthly !== seed.monthly && unitPrice.monthly % 100 === 0;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface SyncAuditRow {
  marketingPlanId: string | null;
  name: string;
  slug: string;
  planId: string | null;
  status: "matched" | "marketingOnly" | "saasOnly" | "priceMismatch" | "featureMismatch" | "limitMismatch" | "archived";
  issues: string[];
}

export interface PricingPlanSyncAudit {
  matched: SyncAuditRow[];
  marketingOnly: SyncAuditRow[];
  saasOnly: SyncAuditRow[];
  priceMismatch: SyncAuditRow[];
  featureMismatch: SyncAuditRow[];
  limitMismatch: SyncAuditRow[];
  currencyMismatch: { planSlug: string; country: string; expected: string; actual: string }[];
  countryMismatch: { planSlug: string; missingInPlan: string[]; extraInPlan: string[] }[];
  customPlans: { slug: string; name: string; isCustomPrice: boolean }[];
  ok: boolean;
}

/** Full consistency audit between the Marketing catalog and SaaS Plans. */
export async function auditPricingPlanSync(): Promise<PricingPlanSyncAudit> {
  const [plans, doc] = await Promise.all([
    prisma.plan.findMany({ include: { countryPrices: true } }),
    getPricingDoc(),
  ]);
  const out: PricingPlanSyncAudit = {
    matched: [],
    marketingOnly: [],
    saasOnly: [],
    priceMismatch: [],
    featureMismatch: [],
    limitMismatch: [],
    currencyMismatch: [],
    countryMismatch: [],
    customPlans: [],
    ok: false,
  };
  const claimed = new Set<string>();

  const pushIssue = (row: SyncAuditRow, issue: string) => {
    row.issues.push(issue);
  };

  for (let i = 0; i < PLANS.length; i++) {
    const cat = PLANS[i];
    const plan = plans.find((p) => p.marketingPlanId === cat.id) ?? plans.find((p) => p.slug === cat.id);
    if (!plan) {
      out.marketingOnly.push({
        marketingPlanId: cat.id, name: cat.name, slug: cat.id, planId: null, status: "marketingOnly",
        issues: ["No canonical SaaS Plan represents this commercial plan"],
      });
      continue;
    }
    claimed.add(plan.id);
    const row: SyncAuditRow = {
      marketingPlanId: cat.id, name: plan.name, slug: plan.slug, planId: plan.id, status: "matched", issues: [],
    };

    if (plan.archivedAt || !plan.isActive) {
      row.status = "archived";
      pushIssue(row, "plan archived/inactive but catalog lists it as active");
      out.marketingOnly.push(row);
      continue;
    }

    // Price alignment: US storefront × 100 must equal billing cents.
    const usStore = (doc.profiles.US?.prices as Record<string, { monthly: number; annual: number }> | undefined)?.[
      cat.id
    ];
    const usRow = plan.countryPrices.find((c) => c.country === "US");
    const isCustom = cat.id === "enterprise";
    if (!isCustom && (usStore || usRow)) {
      if (
        (usRow && (usRow.monthly * 100 !== plan.monthlyPrice || usRow.annual * 100 !== plan.annualPrice)) ||
        (!usRow && usStore && (usStore.monthly * 100 !== plan.monthlyPrice || usStore.annual * 100 !== plan.annualPrice))
      ) {
        row.status = "priceMismatch";
        pushIssue(
          row,
          `billing ${plan.monthlyPrice}/${plan.annualPrice}¢ != US storefront ${usRow?.monthly ?? usStore?.monthly}/${usRow?.annual ?? usStore?.annual} ×100`
        );
      }
      if (usStore && usRow && (usStore.monthly !== usRow.monthly || usStore.annual !== usRow.annual)) {
        row.status = "priceMismatch";
        pushIssue(row, `PricingDoc US ${usStore.monthly}/${usStore.annual} != PlanCountryPrice ${usRow.monthly}/${usRow.annual}`);
      }
      if (row.status === "priceMismatch") {
        out.priceMismatch.push(row);
        continue;
      }
    }

    // Feature representation.
    const feats = (plan.features as Record<string, unknown> | null) ?? {};
    const cardFeatures = Array.isArray(feats.cardFeatures) ? (feats.cardFeatures as string[]) : [];
    if (
      JSON.stringify(cardFeatures) !== JSON.stringify(cat.cardFeatures) ||
      plan.tagline !== cat.tagline ||
      plan.descriptor !== cat.descriptor
    ) {
      row.status = "featureMismatch";
      pushIssue(row, "commercial copy/features differ from catalog");
      out.featureMismatch.push(row);
      continue;
    }

    // Limits.
    if (
      plan.roomMin !== cat.roomMin ||
      plan.roomMax !== (cat.roomMax ?? null) ||
      plan.adminLimit !== cat.adminLimit ||
      plan.staffLimit !== cat.staffLimit ||
      !!plan.featured !== !!cat.featured ||
      plan.displayOrder !== i ||
      plan.isCustomPrice !== isCustom
    ) {
      row.status = "limitMismatch";
      pushIssue(row, "limits/ordering/custom flags differ from catalog");
      out.limitMismatch.push(row);
      continue;
    }

    // Currency/country coverage.
    const docCountries = new Set(Object.keys(doc.profiles));
    const planCountries = new Set(plan.countryPrices.map((c) => c.country));
    const missingInPlan = [...docCountries].filter((c) => !planCountries.has(c));
    const extraInPlan = [...planCountries].filter((c) => !docCountries.has(c));
    if (missingInPlan.length || extraInPlan.length) {
      out.countryMismatch.push({ planSlug: plan.slug, missingInPlan, extraInPlan });
    }
    for (const cp of plan.countryPrices) {
      const prof = doc.profiles[cp.country];
      if (prof && prof.currency !== cp.currency) {
        out.currencyMismatch.push({ planSlug: plan.slug, country: cp.country, expected: prof.currency, actual: cp.currency });
      }
    }

    out.matched.push(row);
  }

  for (const p of plans) {
    if (claimed.has(p.id)) continue;
    if (p.archivedAt || !p.isActive) continue; // documented exception: archived history
    out.saasOnly.push({
      marketingPlanId: p.marketingPlanId, name: p.name, slug: p.slug, planId: p.id, status: "saasOnly",
      issues: ["Active SaaS plan without a Marketing catalog counterpart"],
    });
  }

  for (const cat of PLANS) {
    const p = plans.find((x) => x.marketingPlanId === cat.id || x.slug === cat.id);
    if (cat.id === "enterprise") {
      out.customPlans.push({ slug: cat.id, name: cat.name, isCustomPrice: !!p?.isCustomPrice });
    }
  }

  out.ok =
    out.marketingOnly.length === 0 &&
    out.saasOnly.length === 0 &&
    out.priceMismatch.length === 0 &&
    out.featureMismatch.length === 0 &&
    out.limitMismatch.length === 0 &&
    out.currencyMismatch.length === 0 &&
    out.countryMismatch.length === 0 &&
    out.customPlans.every((c) => c.isCustomPrice);
  return out;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export type ReconcileActionType = "CREATE" | "UPDATE" | "MAP" | "ARCHIVE" | "REPAIR" | "CONFLICT";

export interface ReconcileAction {
  type: ReconcileActionType;
  target: string;
  detail: string;
  deterministic: boolean;
}

export interface ReconcileReport {
  actions: ReconcileAction[];
  applied: number;
  dryRun: boolean;
  conflicts: ReconcileAction[];
}

async function syncCountryPricesForPlan(planId: string, doc: PricingDoc, marketingPlanId: string): Promise<number> {
  const rows = catalogCountryPrices(doc, marketingPlanId);
  let written = 0;
  for (const r of rows) {
    await prisma.planCountryPrice.upsert({
      where: { planId_country: { planId, country: r.country } },
      create: { planId, country: r.country, currency: r.currency, monthly: r.monthly, annual: r.annual },
      update: { currency: r.currency, monthly: r.monthly, annual: r.annual },
    });
    written++;
  }
  return written;
}

/**
 * Bring the canonical Plan table in line with the Marketing catalog.
 * Dry run first: returns the classified action list without touching data.
 */
export async function reconcilePlans(opts: { dryRun?: boolean } = {}): Promise<ReconcileReport> {
  const dryRun = opts.dryRun !== false; // default true — callers must opt in to apply
  const actions: ReconcileAction[] = [];
  const [plans, doc] = await Promise.all([
    prisma.plan.findMany({ include: { countryPrices: true } }),
    getPricingDoc(),
  ]);

  const byMarketing = new Map(plans.filter((p) => p.marketingPlanId).map((p) => [p.marketingPlanId!, p]));
  const bySlug = new Map(plans.map((p) => [p.slug, p]));
  const inputs = buildCatalogPlanInputs();

  // REPAIR: contaminated storefront cells first (they feed everything else).
  const repairedDocProfiles = structuredClone(doc.profiles);
  for (const slug of PLAN_IDS) {
    const cell = (repairedDocProfiles.US?.prices as Record<string, { monthly: number; annual: number }> | undefined)?.[slug];
    if (looksLikeCentContamination(cell, slug)) {
      const seed = usSeedPrice(slug);
      (repairedDocProfiles.US.prices as Record<string, { monthly: number; annual: number }>)[slug] = { ...seed };
      actions.push({
        type: "REPAIR",
        target: `PricingDoc US.${slug}`,
        detail: `${cell!.monthly}/${cell!.annual} contains leaked billing cents; restoring seed default ${seed.monthly}/${seed.annual}`,
        deterministic: true,
      });
    }
  }
  const effectiveDoc: PricingDoc = { ...doc, profiles: repairedDocProfiles };

  // CREATE / MAP / UPDATE per catalog entry.
  for (const input of inputs) {
    const plan = byMarketing.get(input.slug!) ?? bySlug.get(input.slug!);
    if (!plan) {
      actions.push({ type: "CREATE", target: input.slug!, detail: `create canonical plan "${input.name}" from catalog`, deterministic: true });
      if (!dryRun) {
        const { createPlan } = await import("@/lib/saas/plans");
        const created = await createPlan(input);
        await syncCountryPricesForPlan(created.id, effectiveDoc, input.slug!);
      }
      continue;
    }
    if (!plan.marketingPlanId) {
      actions.push({ type: "MAP", target: input.slug!, detail: `attach marketingPlanId to existing plan ${plan.id}`, deterministic: true });
    }
    // Compare commercial definition.
    const diffs: string[] = [];
    const feats = (plan.features as Record<string, unknown> | null) ?? {};
    const cardFeatures = Array.isArray(feats.cardFeatures) ? (feats.cardFeatures as string[]) : [];
    const idx = inputs.findIndex((i2) => i2.slug === input.slug);
    if (JSON.stringify(cardFeatures) !== JSON.stringify(input.features!.cardFeatures)) diffs.push("cardFeatures");
    if (plan.tagline !== input.tagline) diffs.push("tagline");
    if (plan.descriptor !== input.descriptor) diffs.push("descriptor");
    if (plan.roomMin !== input.roomMin!) diffs.push("roomMin");
    if (plan.roomMax !== input.roomMax!) diffs.push("roomMax");
    if (plan.adminLimit !== input.adminLimit!) diffs.push("adminLimit");
    if (plan.staffLimit !== input.staffLimit!) diffs.push("staffLimit");
    if (!!plan.featured !== !!input.featured) diffs.push("featured");
    if (plan.displayOrder !== idx) diffs.push("displayOrder");

    // Billing alignment from the (repaired) US storefront.
    const usCell = (effectiveDoc.profiles.US?.prices as Record<string, { monthly: number; annual: number }> | undefined)?.[input.slug!];
    const isCustom = input.isCustomPrice!;
    if (!isCustom && usCell && (usCell.monthly * 100 !== plan.monthlyPrice || usCell.annual * 100 !== plan.annualPrice)) {
      diffs.push(`billing ${plan.monthlyPrice}→${usCell.monthly * 100}¢`);
    }
    if (isCustom && !plan.isCustomPrice) diffs.push("isCustomPrice");

    if (diffs.length) {
      actions.push({ type: "UPDATE", target: input.slug!, detail: `align with catalog: ${diffs.join(", ")}`, deterministic: true });
      if (!dryRun) {
        const patch: Record<string, unknown> = {
          marketingPlanId: input.slug!,
          features: { ...feats, cardFeatures: input.features!.cardFeatures },
          tagline: input.tagline,
          descriptor: input.descriptor,
          roomMin: input.roomMin,
          roomMax: input.roomMax,
          adminLimit: input.adminLimit,
          staffLimit: input.staffLimit,
          featured: input.featured,
          displayOrder: idx,
          isCustomPrice: isCustom,
          ...(isCustom ? {} : usCell ? { monthlyPrice: usCell.monthly * 100, annualPrice: usCell.annual * 100 } : {}),
        };
        const { updatePlan } = await import("@/lib/saas/plans");
        await updatePlan(plan.id, patch as never);
        await syncCountryPricesForPlan(plan.id, effectiveDoc, input.slug!);
      }
    } else if (!dryRun) {
      await syncCountryPricesForPlan(plan.id, effectiveDoc, input.slug!);
    }
  }

  // ARCHIVE: active plans with no marketing counterpart.
  for (const p of plans) {
    if (p.marketingPlanId && PLAN_IDS.includes(p.marketingPlanId as never)) continue;
    if (PLAN_IDS.includes(p.slug as never)) continue;
    if (p.archivedAt || !p.isActive) continue;
    const subs = await prisma.subscription.count({ where: { planId: p.id } });
    actions.push({
      type: "ARCHIVE",
      target: p.slug,
      detail: `active plan without Marketing counterpart (${subs} historical subscriptions preserved via archive)`,
      deterministic: true,
    });
    if (!dryRun) {
      const { archivePlan } = await import("@/lib/saas/plans");
      await archivePlan(p.id);
    }
  }

  // Persist repaired storefront cells.
  const repairActions = actions.filter((a) => a.type === "REPAIR");
  if (!dryRun && repairActions.length > 0) {
    const { savePricingDoc } = await import("@/lib/pricing/db");
    await savePricingDoc({
      profiles: effectiveDoc.profiles,
      label: "Repair storefront baseline contamination (billing cents leaked into unit scale)",
      byEmail: "system@reconcile",
    });
  }

  const conflicts = actions.filter((a) => !a.deterministic);
  return {
    actions,
    applied: dryRun ? 0 : actions.length,
    dryRun,
    conflicts,
  };
}
