import { prisma } from "@/lib/prisma";

export type OrgInput = {
  legalName: string;
  businessName?: string;
  country?: string;
  industry?: string;
  website?: string;
  acquisitionSource?: string;
  acquisitionCampaign?: string;
  affiliateId?: string;
  partnerId?: string;
  primaryContact?: { name: string; email: string; phone?: string };
};

export type OrgSortField = "createdAt" | "legalName" | "mrr" | "healthScore";

export async function listOrganizations(opts?: {
  q?: string;
  country?: string;
  status?: string;
  take?: number;
  skip?: number;
  sort?: OrgSortField;
  dir?: "asc" | "desc";
}) {
  const where: Record<string, unknown> = {};
  if (opts?.q) {
    // SQLite has no Prisma `mode:"insensitive"` (it throws at runtime).
    // LIKE is case-insensitive for ASCII in SQLite, so prefilter ids raw.
    // Wildcard metacharacters are stripped (avoids ESCAPE quirks).
    const like = `%${opts.q.replace(/[%_\\]/g, "")}%`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM Organization WHERE legalName LIKE ${like} OR businessName LIKE ${like}`;
    if (rows.length === 0) return { items: [], total: 0 };
    where.id = { in: rows.map((r) => r.id) };
  }
  if (opts?.country) where.country = opts.country;
  if (opts?.status) where.status = opts.status;
  const sort: OrgSortField = opts?.sort && ["createdAt", "legalName", "mrr", "healthScore"].includes(opts.sort) ? opts.sort : "createdAt";
  const orderBy: Record<string, "asc" | "desc"> = { [sort]: opts?.dir === "asc" ? "asc" : "desc" };
  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: { contacts: true, properties: true, subscriptions: { include: { plan: true } } },
      orderBy,
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    }),
    prisma.organization.count({ where }),
  ]);
  return { items, total };
}

/** Distinct countries present across organizations — powers the country filter. */
export async function listOrganizationCountries(): Promise<string[]> {
  const rows = await prisma.organization.findMany({
    where: { country: { not: null } },
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });
  return rows.map((r) => r.country as string);
}

export async function getOrganization(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: { contacts: true, properties: true, subscriptions: { include: { plan: true, invoices: true } }, invoices: true },
  });
}

export function validateOrgInput(input: OrgInput): { ok: true } | { ok: false; error: string } {
  const legal = input.legalName?.trim();
  if (!legal || legal.length < 2) return { ok: false, error: "legalName must be at least 2 characters" };
  if (legal.length > 200) return { ok: false, error: "legalName too long" };
  if (input.country && !/^[A-Za-z]{2}$/.test(input.country.trim())) return { ok: false, error: "country must be ISO2" };
  if (input.website && input.website.length > 500) return { ok: false, error: "website too long" };
  if (input.primaryContact) {
    if (!input.primaryContact.name?.trim()) return { ok: false, error: "contact name required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.primaryContact.email)) return { ok: false, error: "contact email invalid" };
  }
  return { ok: true };
}

export async function createOrganization(input: OrgInput) {
  const v = validateOrgInput(input);
  if (!v.ok) throw new Error(v.error);
  // validate affiliate if provided
  if (input.affiliateId) {
    const aff = await prisma.affiliate.findUnique({ where: { id: input.affiliateId }, select: { id: true, status: true } });
    if (!aff) throw new Error("Affiliate not found");
    if (aff.status !== "active" && aff.status !== "approved") throw new Error("Affiliate not active");
  }
  // validate partner if provided
  let validPartnerId: string | null = null;
  if (input.partnerId) {
    const p = await prisma.partner.findUnique({ where: { id: input.partnerId }, select: { id: true, status: true } });
    if (!p) throw new Error("Partner not found");
    if (p.status !== "active" && p.status !== "approved") throw new Error("Partner not active");
    validPartnerId = p.id;
  }
  return prisma.organization.create({
    data: {
      legalName: input.legalName.trim(),
      businessName: input.businessName?.trim() || null,
      country: input.country?.toUpperCase() || null,
      industry: input.industry || null,
      website: input.website || null,
      acquisitionSource: input.acquisitionSource || null,
      acquisitionCampaign: input.acquisitionCampaign || null,
      affiliateId: input.affiliateId || null,
      partnerId: validPartnerId,
      contacts: input.primaryContact
        ? {
            create: {
              name: input.primaryContact.name.trim(),
              email: input.primaryContact.email.toLowerCase(),
              phone: input.primaryContact.phone || null,
              isPrimary: true,
            },
          }
        : undefined,
    },
    include: { contacts: true },
  });
}

export function validateOrgPatch(patch: Partial<OrgInput> & { status?: string; healthScore?: number }): { ok: true } | { ok: false; error: string } {
  if (patch.legalName !== undefined) {
    const v = patch.legalName.trim();
    if (!v || v.length < 2) return { ok: false, error: "legalName must be at least 2 characters" };
    if (v.length > 200) return { ok: false, error: "legalName too long" };
  }
  if (patch.country !== undefined && patch.country && !/^[A-Za-z]{2}$/.test(patch.country.trim())) return { ok: false, error: "country must be ISO2" };
  if (patch.status !== undefined && !["active", "suspended", "cancelled"].includes(patch.status)) return { ok: false, error: "invalid status" };
  if (patch.healthScore !== undefined && (patch.healthScore < 0 || patch.healthScore > 100)) return { ok: false, error: "healthScore must be 0-100" };
  return { ok: true };
}

export async function updateOrganization(id: string, patch: Partial<OrgInput> & { status?: string; healthScore?: number }) {
  const v = validateOrgPatch(patch);
  if (!v.ok) throw new Error(v.error);
  return prisma.organization.update({
    where: { id },
    data: {
      legalName: patch.legalName?.trim(),
      businessName: patch.businessName !== undefined ? patch.businessName?.trim() || null : undefined,
      country: patch.country !== undefined ? (patch.country ? patch.country.toUpperCase() : null) : undefined,
      industry: patch.industry,
      website: patch.website,
      status: patch.status,
      healthScore: patch.healthScore,
    },
  });
}

export async function deleteOrganization(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, legalName: true },
  });
  if (!org) throw new Error("Organization not found");

  const [subCount, invoiceCount] = await Promise.all([
    prisma.subscription.count({ where: { organizationId: id } }),
    prisma.invoice.count({ where: { organizationId: id } }),
  ]);
  if (subCount > 0 || invoiceCount > 0) {
    throw new Error(`Cannot delete organization "${org.legalName}" with ${subCount} subscription(s) and ${invoiceCount} invoice(s). Archive it first.`);
  }

  await prisma.organization.delete({ where: { id } });
}
