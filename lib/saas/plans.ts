import { prisma } from "@/lib/prisma";

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
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
  monthlyPrice: number; // cents
  annualPrice: number;
  currency?: string;
  trialDays?: number;
  maxProperties?: number | null;
  maxUsers?: number | null;
  maxBookings?: number | null;
  storageGb?: number | null;
  features?: Record<string, unknown>;
  isActive?: boolean;
};

export async function createPlan(input: PlanInput) {
  const v = validatePlanInput(input, true);
  if (!v.ok) throw new Error(v.error);
  const existing = await prisma.plan.findUnique({ where: { slug: input.slug.trim().toLowerCase() } });
  if (existing) throw new Error("slug already exists");
  return prisma.plan.create({
    data: {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
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
    },
  });
}

export function validatePlanInput(input: Partial<PlanInput>, isCreate = true): { ok: true } | { ok: false; error: string } {
  if (isCreate) {
    if (!input.name?.trim() || input.name.trim().length < 2) return { ok: false, error: "name must be at least 2 characters" };
    if (!input.slug?.trim() || !/^[a-z0-9-]+$/.test(input.slug.trim().toLowerCase())) return { ok: false, error: "slug must be lowercase alphanumeric/hyphen" };
    if (typeof input.monthlyPrice !== "number" || input.monthlyPrice < 0) return { ok: false, error: "monthlyPrice must be >= 0" };
    if (typeof input.annualPrice !== "number" || input.annualPrice < 0) return { ok: false, error: "annualPrice must be >= 0" };
  } else {
    if (input.name !== undefined && (!input.name.trim() || input.name.trim().length < 2)) return { ok: false, error: "name must be at least 2 characters" };
    if (input.slug !== undefined && !/^[a-z0-9-]+$/.test(input.slug.trim().toLowerCase())) return { ok: false, error: "slug invalid" };
    if (input.monthlyPrice !== undefined && (typeof input.monthlyPrice !== "number" || input.monthlyPrice < 0)) return { ok: false, error: "monthlyPrice must be >= 0" };
    if (input.annualPrice !== undefined && (typeof input.annualPrice !== "number" || input.annualPrice < 0)) return { ok: false, error: "annualPrice must be >= 0" };
  }
  if (input.trialDays !== undefined && (input.trialDays < 0 || input.trialDays > 365)) return { ok: false, error: "trialDays must be 0-365" };
  if (input.currency !== undefined && input.currency && !/^[A-Z]{3}$/.test(input.currency)) return { ok: false, error: "currency must be 3-letter ISO" };
  return { ok: true };
}

export async function updatePlan(id: string, patch: Partial<PlanInput>) {
  const v = validatePlanInput(patch, false);
  if (!v.ok) throw new Error(v.error);
  // unique slug check
  if (patch.slug) {
    const existing = await prisma.plan.findUnique({ where: { slug: patch.slug.trim().toLowerCase() } });
    if (existing && existing.id !== id) throw new Error("slug already exists");
  }
  return prisma.plan.update({
    where: { id },
    data: {
      name: patch.name?.trim(),
      slug: patch.slug?.trim().toLowerCase(),
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
      // Optimistic-concurrency counter consumed by the approval workflow.
      version: { increment: 1 },
    },
  });
}

export async function deletePlan(id: string) {
  const count = await prisma.subscription.count({ where: { planId: id } });
  if (count > 0) throw new Error("Cannot delete plan with active subscriptions");
  await prisma.plan.delete({ where: { id } });
}

export async function seedDefaultPlans() {
  const existing = await prisma.plan.count();
  if (existing > 0) return;
  const defaults: PlanInput[] = [
    { name: "Starter", slug: "starter", monthlyPrice: 4900, annualPrice: 49000, trialDays: 14, maxProperties: 1, maxUsers: 3, storageGb: 5, features: { reports: false, api: false, marketing: false } },
    { name: "Professional", slug: "professional", monthlyPrice: 9900, annualPrice: 99000, trialDays: 14, maxProperties: 5, maxUsers: 15, storageGb: 20, features: { reports: true, api: true, marketing: true } },
    { name: "Business", slug: "business", monthlyPrice: 19900, annualPrice: 199000, trialDays: 14, maxProperties: 20, maxUsers: 50, storageGb: 100, features: { reports: true, api: true, marketing: true, automation: true } },
    { name: "Enterprise", slug: "enterprise", monthlyPrice: 49900, annualPrice: 499000, trialDays: 14, maxProperties: null, maxUsers: null, storageGb: null, features: { reports: true, api: true, marketing: true, automation: true, prioritySupport: true } },
  ];
  for (const p of defaults) await createPlan(p);
}
