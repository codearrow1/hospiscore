/**
 * Country-price synchronization service.
 *
 * One authoritative relationship already exists:
 *   PlanCountryPrice(planId, country)  ↔  Marketing PricingDoc profile cell
 * (same local-currency units, unique per plan+market). This module is the
 * ONLY writer of that relationship from the SaaS side and the applier used by
 * the approval workflow on the Marketing side, so both directions stay in
 * lockstep without duplicating pricing records.
 *
 * Invariants enforced here:
 * - currency always equals the market's catalog currency (no unit mixing)
 * - US baseline: monthly ×100 == Plan.monthlyPrice billing cents
 *   (except contact-sales plans, which keep 0/0 "Contact us")
 * - Enterprise/custom semantics never get numeric self-serve prices
 */
import { prisma } from "@/lib/prisma";
import { countryListing, SEED_COUNTRIES } from "@/lib/pricing/countries";
import { CURRENCIES } from "@/lib/pricing/currencies";

// ---------------------------------------------------------------------------
// Pure validation / resolution helpers
// ---------------------------------------------------------------------------

export interface CountryPriceEntry {
  country: string;
  currency?: string;
  monthly: number;
  annual: number;
}

export function isValidIsoAmount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v);
}

export type ValidatedEntry = { country: string; currency: string; monthly: number; annual: number };

/** Validate one country price entry against the existing country catalog. */
export function validateCountryPriceEntry(entry: unknown): { ok: true; value: ValidatedEntry } | { ok: false; error: string } {
  if (typeof entry !== "object" || entry === null) return { ok: false, error: "countryPrices entries must be objects" };
  const e = entry as Record<string, unknown>;
  const rawCountry = typeof e.country === "string" ? e.country.trim().toUpperCase() : "";
  const listing = countryListing(rawCountry);
  if (!listing) {
    return { ok: false, error: `unknown country "${rawCountry}" — must be one of ${SEED_COUNTRIES.map((c) => c.code).join(",")}` };
  }
  if (!isValidIsoAmount(e.monthly)) return { ok: false, error: `${listing.code}: monthly must be a non-negative integer (${listing.currency} units)` };
  if (!isValidIsoAmount(e.annual)) return { ok: false, error: `${listing.code}: annual must be a non-negative integer (${listing.currency} units)` };
  if (e.currency !== undefined && e.currency !== listing.currency) {
    return { ok: false, error: `${listing.code}: currency must be ${listing.currency} (catalog currency for this market)` };
  }
  if (!CURRENCIES[listing.currency]) return { ok: false, error: `${listing.code}: unsupported currency ${listing.currency}` };
  return {
    ok: true,
    value: { country: listing.code, currency: listing.currency, monthly: e.monthly, annual: e.annual },
  };
}

export function validateCountryPriceEntries(entries: unknown): { ok: true; value: ValidatedEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(entries)) return { ok: false, error: "countryPrices must be an array" };
  if (entries.length === 0) return { ok: false, error: "countryPrices must not be empty" };
  const seen = new Set<string>();
  const out: ValidatedEntry[] = [];
  for (const raw of entries) {
    const v = validateCountryPriceEntry(raw);
    if (!v.ok) return v;
    if (seen.has(v.value.country)) return { ok: false, error: `duplicate country ${v.value.country}` };
    seen.add(v.value.country);
    out.push(v.value);
  }
  return { ok: true, value: out };
}

export interface ResolvedPrice {
  country: string;
  currency: string;
  monthly: number;
  annual: number;
  custom: boolean;
}

/**
 * Resolve the commercial price for a plan+market. Returns `custom: true` with
 * null-ish amounts for contact-sales plans. Falls back to plan billing ÷100
 * only for the US market (the defined baseline), never fabricates FX.
 */
export async function resolvePlanPrice(planId: string, countryRaw: string): Promise<ResolvedPrice | null> {
  const code = countryListing(countryRaw)?.code ?? String(countryRaw ?? "").trim().toUpperCase();
  const [plan, row] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    prisma.planCountryPrice.findUnique({ where: { planId_country: { planId, country: code } } }),
  ]);
  if (!plan || !plan.isActive || plan.archivedAt) return null;
  const listing = countryListing(code);
  if (plan.isCustomPrice) {
    return { country: code, currency: listing?.currency ?? "USD", monthly: 0, annual: 0, custom: true };
  }
  if (row) return { country: row.country, currency: row.currency, monthly: row.monthly, annual: row.annual, custom: false };
  if (code === "US") {
    return { country: "US", currency: "USD", monthly: Math.round(plan.monthlyPrice / 100), annual: Math.round(plan.annualPrice / 100), custom: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Canonical write path (SaaS-side edits AND approved Marketing proposals)
// ---------------------------------------------------------------------------

async function mirrorIntoPricingDoc(
  marketingPlanId: string,
  entries: ValidatedEntry[],
  byEmail: string,
  reason: string,
): Promise<number> {
  const { getPricingDoc, savePricingDoc } = await import("@/lib/pricing/db");
  const doc = await getPricingDoc();
  const profiles = structuredClone(doc.profiles);
  let written = 0;
  for (const e of entries) {
    const profile = profiles[e.country] as { prices: Record<string, { monthly: number; annual: number }> } | undefined;
    if (!profile?.prices?.[marketingPlanId]) continue; // market not configured for this plan → nothing to mirror
    profile.prices[marketingPlanId] = { monthly: e.monthly, annual: e.annual };
    written++;
  }
  if (written > 0) await savePricingDoc({ profiles, label: reason, byEmail });
  return written;
}

export interface ApplyCountryPricesResult {
  applied: ValidatedEntry[];
  mirroredCells: number;
  billingUpdated: boolean;
}

/**
 * Write canonical country prices + keep every dependent representation in
 * sync: PlanCountryPrice rows, the US↔billing invariant and the Marketing
 * PricingDoc storefront cells. Used by both sync directions so they can never
 * diverge.
 */
export async function applyCountryPrices(planId: string, rawEntries: ValidatedEntry[], byEmail: string): Promise<ApplyCountryPricesResult> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("plan not found");
  const marketingPlanId = plan.marketingPlanId ?? plan.slug;

  // 1. Canonical rows (unique planId+country upserts — no duplicates possible).
  for (const e of rawEntries) {
    await prisma.planCountryPrice.upsert({
      where: { planId_country: { planId, country: e.country } },
      create: { planId, country: e.country, currency: e.currency, monthly: e.monthly, annual: e.annual },
      update: { currency: e.currency, monthly: e.monthly, annual: e.annual },
    });
  }

  // 2. US baseline invariant → billing cents are canonical for MRR/invoices.
  let billingUpdated = false;
  const us = rawEntries.find((e) => e.country === "US");
  if (us && !plan.isCustomPrice && !plan.archivedAt) {
    const cents = { monthlyPrice: us.monthly * 100, annualPrice: us.annual * 100 };
    if (cents.monthlyPrice !== plan.monthlyPrice || cents.annualPrice !== plan.annualPrice) {
      await prisma.plan.update({ where: { id: plan.id }, data: { ...cents, version: { increment: 1 } } });
      billingUpdated = true;
    }
  }

  // 3. Mirror storefront cells into the Marketing PricingDoc (same units).
  const mirroredCells = await mirrorIntoPricingDoc(
    marketingPlanId,
    rawEntries,
    byEmail,
    `Country prices updated from SaaS admin for "${plan.name}" (${marketingPlanId}): ${rawEntries.map((e) => `${e.country} ${e.monthly}/${e.annual}`).join(", ")}`,
  );

  return { applied: rawEntries, mirroredCells, billingUpdated };
}

/** All country prices for the global matrix view (optionally filtered). */
export async function listCountryPrices(opts?: { planId?: string; country?: string; currency?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.planId) where.planId = opts.planId;
  if (opts?.country) where.country = opts.country;
  if (opts?.currency) where.currency = opts.currency;
  return prisma.planCountryPrice.findMany({
    where,
    orderBy: [{ country: "asc" }, { planId: "asc" }],
    include: { plan: { select: { id: true, name: true, slug: true, isActive: true, archivedAt: true, isCustomPrice: true } } },
  });
}
