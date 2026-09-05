import { prisma } from "@/lib/prisma";

export async function listPlans(opts?: { includeArchived?: boolean }) {
  return prisma.plan.findMany({
    where: opts?.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { monthlyPrice: "asc" }],
  });
}

export async function getPlan(id: string) {
  return prisma.plan.findUnique({ where: { id } });
}

export async function getPlanBySlug(slug: string) {
  return prisma.plan.findUnique({ where: { slug } });
}

export type PlanInput = {
  name: string;
  slug: string;
  /** Stable cross-system identity — lib/pricing/catalog.ts PLAN_IDS entry. */
  marketingPlanId?: string | null;
  monthlyPrice: number; // USD cents — billing canonical
  annualPrice: number;
  currency?: string;
  trialDays?: number;
  maxProperties?: number | null;
  maxUsers?: number | null;
  maxBookings?: number | null;
  storageGb?: number | null;
  features?: Record<string, unknown>;
  isActive?: boolean;
  description?: string | null;
  tagline?: string | null;
  descriptor?: string | null;
  roomMin?: number | null;
  roomMax?: number | null;
  adminLimit?: number | null;
  staffLimit?: number | null;
  featured?: boolean;
  displayOrder?: number;
  isCustomPrice?: boolean;
};

/**
 * Strict numeric coercion for API payloads. null / "" / non-finite values are
 * rejected instead of silently becoming 0 (Number(null) === 0) or NaN.
 */
export function coerceNumber(label: string, v: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: false, error: `${label} must be a number` };
  const n = typeof v === "string" ? Number(v.trim()) : Number(v);
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a finite number` };
  return { ok: true, value: n };
}

/** Like coerceNumber but treats null/undefined/"" as an explicit NULL column. */
export function coerceOptionalNumber(label: string, v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  const r = coerceNumber(label, v);
  return r.ok ? { ok: true, value: r.value } : r;
}

export async function createPlan(input: PlanInput) {
  const v = validatePlanInput(input, true);
  if (!v.ok) throw new Error(v.error);
  const slug = input.slug.trim().toLowerCase();
  const existing = await prisma.plan.findUnique({ where: { slug } });
  if (existing) throw new Error("slug already exists");
  return prisma.plan.create({
    data: {
      name: input.name.trim(),
      slug,
      marketingPlanId: input.marketingPlanId ?? slug,
      monthlyPrice: input.monthlyPrice,
      annualPrice: input.annualPrice,
      currency: input.currency || "USD",
      trialDays: input.trialDays ?? 14,
      maxProperties: input.maxProperties ?? null,
      maxUsers: input.maxUsers ?? null,
      maxBookings: input.maxBookings ?? null,
      storageGb: input.storageGb ?? null,
      features: (input.features as never) ?? undefined,
      isActive: input.isActive ?? true,
      description: input.description ?? null,
      tagline: input.tagline ?? null,
      descriptor: input.descriptor ?? null,
      roomMin: input.roomMin ?? null,
      roomMax: input.roomMax ?? null,
      adminLimit: input.adminLimit ?? null,
      staffLimit: input.staffLimit ?? null,
      featured: input.featured ?? false,
      displayOrder: input.displayOrder ?? 0,
      isCustomPrice: input.isCustomPrice ?? false,
    },
  });
}

export function validatePlanInput(
  input: Partial<PlanInput>,
  isCreate = true,
): { ok: true } | { ok: false; error: string } {
  if (isCreate) {
    if (!input.name?.trim() || input.name.trim().length < 2)
      return { ok: false, error: "name must be at least 2 characters" };
    if (!input.slug?.trim() || !/^[a-z0-9-]+$/.test(input.slug.trim().toLowerCase()))
      return { ok: false, error: "slug must be lowercase alphanumeric/hyphen" };
    if (typeof input.monthlyPrice !== "number" || !Number.isFinite(input.monthlyPrice) || input.monthlyPrice < 0)
      return { ok: false, error: "monthlyPrice must be a finite number >= 0" };
    if (typeof input.annualPrice !== "number" || !Number.isFinite(input.annualPrice) || input.annualPrice < 0)
      return { ok: false, error: "annualPrice must be a finite number >= 0" };
  } else {
    if (input.name !== undefined && (!input.name.trim() || input.name.trim().length < 2))
      return { ok: false, error: "name must be at least 2 characters" };
    if (input.slug !== undefined && !/^[a-z0-9-]+$/.test(input.slug.trim().toLowerCase()))
      return { ok: false, error: "slug invalid" };
    if (input.monthlyPrice !== undefined && (typeof input.monthlyPrice !== "number" || !Number.isFinite(input.monthlyPrice) || input.monthlyPrice < 0))
      return { ok: false, error: "monthlyPrice must be a finite number >= 0" };
    if (input.annualPrice !== undefined && (typeof input.annualPrice !== "number" || !Number.isFinite(input.annualPrice) || input.annualPrice < 0))
      return { ok: false, error: "annualPrice must be a finite number >= 0" };
  }
  if (input.trialDays !== undefined && (input.trialDays < 0 || input.trialDays > 365))
    return { ok: false, error: "trialDays must be 0-365" };
  if (input.currency !== undefined && input.currency && !/^[A-Z]{3}$/.test(input.currency))
    return { ok: false, error: "currency must be 3-letter ISO" };
  if (input.displayOrder !== undefined && (typeof input.displayOrder !== "number" || input.displayOrder < 0))
    return { ok: false, error: "displayOrder must be >= 0" };
  return { ok: true };
}

export async function updatePlan(id: string, patch: Partial<PlanInput>) {
  const v = validatePlanInput(patch, false);
  if (!v.ok) throw new Error(v.error);
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new Error("Plan not found");
  // Archived plans are historical records — editing them (or reactivating
  // them via isActive) is blocked; archive keeps audit references intact.
  if (existing.archivedAt) throw new Error("Plan is archived and cannot be edited");
  // unique slug check
  if (patch.slug) {
    const slug = patch.slug.trim().toLowerCase();
    if (slug !== existing.slug) {
      const dup = await prisma.plan.findUnique({ where: { slug } });
      if (dup && dup.id !== id) throw new Error("slug already exists");
    }
  }
  return prisma.plan.update({
    where: { id },
    data: {
      name: patch.name?.trim(),
      slug: patch.slug?.trim().toLowerCase(),
      marketingPlanId: patch.marketingPlanId !== undefined ? patch.marketingPlanId : undefined,
      monthlyPrice: patch.monthlyPrice,
      annualPrice: patch.annualPrice,
      currency: patch.currency,
      trialDays: patch.trialDays,
      maxProperties: patch.maxProperties,
      maxUsers: patch.maxUsers,
      maxBookings: patch.maxBookings,
      storageGb: patch.storageGb,
      features: patch.features !== undefined ? (patch.features as never) : undefined,
      isActive: patch.isActive,
      description: patch.description,
      tagline: patch.tagline,
      descriptor: patch.descriptor,
      roomMin: patch.roomMin,
      roomMax: patch.roomMax,
      adminLimit: patch.adminLimit,
      staffLimit: patch.staffLimit,
      featured: patch.featured,
      displayOrder: patch.displayOrder,
      isCustomPrice: patch.isCustomPrice,
      // Optimistic-concurrency counter consumed by the approval workflow.
      version: { increment: 1 },
    },
  });
}

/**
 * Archive a plan instead of deleting it: subscriptions, invoices and other
 * historical rows keep referencing the original plan id forever.
 */
export async function archivePlan(id: string) {
  const count = await prisma.subscription.count({ where: { planId: id } });
  if (count === 0) {
    // Nothing references it — a hard delete is safe, but archiving keeps the
    // audit story uniform, so archive either way.
  }
  return prisma.plan.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date(), version: { increment: 1 } },
  });
}

export async function deletePlan(id: string) {
  const count = await prisma.subscription.count({ where: { planId: id } });
  if (count > 0) throw new Error("Cannot delete plan with active subscriptions");
  await prisma.plan.delete({ where: { id } });
}

/**
 * Bootstrap an EMPTY database with the Marketing pricing catalog (US baseline
 * ×100). Existing databases are structured by the reconcile service instead.
 */
export async function seedDefaultPlans() {
  const existing = await prisma.plan.count();
  if (existing > 0) return;
  const { buildCatalogPlanInputs } = await import("@/lib/saas/planCatalog");
  const inputs = buildCatalogPlanInputs();
  for (const p of inputs) await createPlan(p);
}
