/**
 * Franchise / Territory Management — Phase P (P2 #22)
 * SaaS-commercial territory network (NOT hotel franchising).
 * Tree: master (country) → region → city. Exclusive territories cannot overlap.
 * Revenue share is configurable bps of customer MRR per franchisee.
 */
import { prisma } from "@/lib/prisma";
import { resolveSetting } from "@/lib/settings/resolver";

export const TERRITORY_TYPES = ["master", "region", "city"] as const;
export type TerritoryType = (typeof TERRITORY_TYPES)[number];
export const FRANCHISEE_STATUSES = ["proposed", "signed", "active", "terminated"] as const;
export type FranchiseeStatus = (typeof FRANCHISEE_STATUSES)[number];

const ALLOWED_FRANCHISEE_STATUS: Record<FranchiseeStatus, FranchiseeStatus[]> = {
  proposed: ["signed", "terminated"],
  signed: ["active", "terminated"],
  active: ["terminated"],
  terminated: [],
};

export function canTransitionFranchisee(from: FranchiseeStatus, to: FranchiseeStatus): boolean {
  if (from === to) return false;
  return ALLOWED_FRANCHISEE_STATUS[from]?.includes(to) ?? false;
}

/**
 * Exclusive territories conflict when an existing ACTIVE exclusive territory
 * covers the same or broader geography in the same country:
 *   new master(country)      vs any exclusive in country
 *   new region(country,reg)  vs master in country | region with same reg
 *   new city(c,reg,city)     vs the above | city with same city
 * ALL active exclusives are inspected — a single findFirst would miss
 * conflicts whenever ≥2 exclusives of different types exist.
 */
export async function findExclusiveConflict(t: { country: string; region?: string | null; city?: string | null; type: string; excludeId?: string }): Promise<{ id: string; name: string } | null> {
  const exclusives = await prisma.franchiseTerritory.findMany({
    where: { status: "active", exclusive: true, country: t.country.toUpperCase(), ...(t.excludeId ? { id: { not: t.excludeId } } : {}) },
    select: { id: true, name: true, type: true, region: true, city: true },
  });
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  for (const ex of exclusives) {
    // master conflicts with everything in-country
    if (t.type === "master" || ex.type === "master") return ex;
    // region vs region (case-insensitive)
    if ((t.type === "region" || t.type === "city") && ex.type === "region") {
      if (norm(ex.region) === norm(t.region)) return ex;
      continue;
    }
    // city vs city (case-insensitive)
    if (t.type === "city" && ex.type === "city") {
      if (norm(ex.region) === norm(t.region) && norm(ex.city) === norm(t.city)) return ex;
    }
  }
  return null;
}

export async function createTerritory(input: { name: string; country: string; region?: string; city?: string; type: string; exclusive?: boolean; franchiseeId?: string; parentTerritoryId?: string }) {
  const name = input.name?.trim();
  if (!name) throw new Error("Name required");
  const country = input.country?.trim().toUpperCase();
  if (!country || country.length !== 2) throw new Error("country must be ISO2");
  if (!TERRITORY_TYPES.includes(input.type as never)) throw new Error("Invalid territory type");
  if (input.exclusive) {
    const conflict = await findExclusiveConflict({ country, region: input.region, city: input.city, type: input.type });
    if (conflict) throw new Error(`Overlaps active exclusive territory "${conflict.name}" (${conflict.id})`);
  }
  let validFranchisee: string | null = null;
  if (input.franchiseeId) {
    const f = await prisma.franchisee.findUnique({ where: { id: input.franchiseeId }, select: { id: true } });
    if (!f) throw new Error("Franchisee not found");
    validFranchisee = f.id;
  }
  if (input.parentTerritoryId) {
    const p = await prisma.franchiseTerritory.findUnique({ where: { id: input.parentTerritoryId }, select: { id: true, country: true } });
    if (!p) throw new Error("Parent territory not found");
    if (p.country !== country) throw new Error("Parent territory must be in the same country");
  }
  return prisma.franchiseTerritory.create({
    data: {
      name,
      country,
      region: input.region || null,
      city: input.city || null,
      type: input.type,
      exclusive: input.exclusive ?? false,
      franchiseeId: validFranchisee,
      parentTerritoryId: input.parentTerritoryId || null,
    },
  });
}

export async function listTerritories(opts?: { country?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.country) where.country = opts.country.toUpperCase();
  const items = await prisma.franchiseTerritory.findMany({
    where,
    include: { franchisee: { select: { company: true, email: true } }, _count: { select: { organizations: true, children: true } } },
    orderBy: [{ country: "asc" }, { type: "asc" }, { name: "asc" }],
    take: 200,
  });
  return { items, total: items.length };
}

export async function updateTerritoryStatus(id: string, status: "active" | "inactive") {
  const t = await prisma.franchiseTerritory.findUnique({ where: { id } });
  if (!t) throw new Error("Territory not found");
  // Reactivating an exclusive must re-run the overlap check — another
  // exclusive may have claimed the geography while this one was inactive.
  if (status === "active" && t.exclusive && t.status !== "active") {
    const conflict = await findExclusiveConflict({ country: t.country, region: t.region, city: t.city, type: t.type, excludeId: t.id });
    if (conflict) throw new Error(`Cannot reactivate: overlaps active exclusive territory "${conflict.name}" (${conflict.id})`);
  }
  return prisma.franchiseTerritory.update({ where: { id }, data: { status } });
}

export async function createFranchisee(input: { company: string; contactName: string; email: string; phone?: string; country?: string; revenueShareBps?: number }) {
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (!input.company?.trim()) throw new Error("Company required");
  const defaultBps = await resolveSetting<number>("franchise_default_revenue_share_bps");
  const bps = input.revenueShareBps ?? defaultBps;
  if (bps <= 0 || bps > 5000) throw new Error("revenueShareBps must be 1-5000");
  const dupe = await prisma.franchisee.findUnique({ where: { email } });
  if (dupe) throw new Error("Franchisee with this email already exists");
  return prisma.franchisee.create({
    data: {
      company: input.company.trim(),
      contactName: input.contactName.trim(),
      email,
      phone: input.phone || null,
      country: input.country?.toUpperCase() || null,
      revenueShareBps: bps,
    },
  });
}

export async function listFranchisees() {
  const items = await prisma.franchisee.findMany({
    include: { territories: { select: { id: true, name: true, type: true, _count: { select: { organizations: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { items, total: items.length };
}

export async function updateFranchiseeStatus(id: string, to: FranchiseeStatus, agreement?: { startAt?: Date; endAt?: Date }) {
  const cur = await prisma.franchisee.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Franchisee not found");
  if (!canTransitionFranchisee(cur.status as FranchiseeStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  const data: Record<string, unknown> = { status: to };
  if (agreement?.startAt) data.agreementStartAt = agreement.startAt;
  if (agreement?.endAt) data.agreementEndAt = agreement.endAt;
  return prisma.franchisee.update({ where: { id }, data });
}

/** Revenue share for one franchisee: bps of MRR across orgs in their active territories. */
export async function franchiseePerformance(franchiseeId: string): Promise<{ customers: number; mrr: number; monthlyShare: number; shareBps: number }> {
  const f = await prisma.franchisee.findUnique({ where: { id: franchiseeId }, include: { territories: { where: { status: "active" }, select: { id: true } } } });
  if (!f) throw new Error("Franchisee not found");
  const territoryIds = f.territories.map((t) => t.id);
  if (territoryIds.length === 0) return { customers: 0, mrr: 0, monthlyShare: 0, shareBps: f.revenueShareBps };
  const agg = await prisma.organization.aggregate({
    where: { franchiseTerritoryId: { in: territoryIds }, status: "active" },
    _count: { id: true },
    _sum: { mrr: true },
  });
  const mrr = agg._sum.mrr ?? 0;
  return {
    customers: agg._count.id,
    mrr,
    monthlyShare: Math.round((mrr * f.revenueShareBps) / 10000),
    shareBps: f.revenueShareBps,
  };
}

/** Assign an organization to a territory (used by detail page/API). */
export async function assignOrgToTerritory(organizationId: string, territoryId: string | null) {
  if (territoryId) {
    const t = await prisma.franchiseTerritory.findUnique({ where: { id: territoryId }, select: { id: true, status: true } });
    if (!t) throw new Error("Territory not found");
    if (t.status !== "active") throw new Error("Territory not active");
  }
  return prisma.organization.update({ where: { id: organizationId }, data: { franchiseTerritoryId: territoryId } });
}
