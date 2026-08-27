/**
 * Property claims (Phase B).
 *
 * A PropertyClaim binds a Google listing (`placeId`) to an Organization,
 * authored by a logged-in org contact. It is the single source of truth for
 * "who owns this listing" and replaces the old client-side localStorage demo.
 *
 * Flow:
 *  1. An org contact submits a claim for a `place:<placeId>` listing.
 *  2. Its status is `pending`; the Google on-file phone is recorded at submit
 *     time so a reviewer can cross-check ownership.
 *  3. An admin approves → the claim links to (or creates) a Property row with
 *     that `placeId`; or rejects with a reason.
 *
 * Dedupe is enforced at the DB layer: one claim per (placeId, organizationId)
 * and one Property per placeId.
 */
import { prisma } from "@/lib/prisma";

export interface ClaimInput {
  organizationId: string;
  placeId: string;
  propertyName: string;
  propertyCity?: string;
  propertyCountry?: string;
  address?: string;
  googlePhone?: string | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  acquisitionSource?: string;
  acquisitionCampaign?: string;
  createdById?: string;
}

export async function createClaim(input: ClaimInput): Promise<{ ok: true; claim: unknown } | { ok: false; error: string }> {
  const pid = input.placeId?.trim();
  const name = input.propertyName?.trim();
  if (!pid || !name) return { ok: false, error: "placeId and propertyName are required" };

  const existing = await prisma.propertyClaim.findUnique({
    where: { placeId_organizationId: { placeId: pid, organizationId: input.organizationId } },
    select: { id: true, status: true },
  });
  if (existing) return { ok: false, error: `This listing already has a ${existing.status} claim from your organization` };

  const property = await prisma.property.findUnique({ where: { placeId: pid }, select: { id: true, organizationId: true } });
  if (property) {
    if (property.organizationId === input.organizationId) {
      return { ok: false, error: "This listing is already claimed by your organization" };
    }
    return { ok: false, error: "This listing is already claimed by another organization" };
  }

  const claim = await prisma.propertyClaim.create({
    data: {
      organizationId: input.organizationId,
      placeId: pid,
      propertyName: name,
      propertyCity: input.propertyCity?.trim() || null,
      propertyCountry: input.propertyCountry?.trim().toUpperCase().slice(0, 2) || null,
      address: input.address?.trim() || null,
      googlePhone: input.googlePhone?.trim() || null,
      requesterName: input.requesterName?.trim() || null,
      requesterEmail: input.requesterEmail?.trim() || null,
      requesterPhone: input.requesterPhone?.trim() || null,
      acquisitionSource: input.acquisitionSource?.trim() || null,
      acquisitionCampaign: input.acquisitionCampaign?.trim() || null,
      createdById: input.createdById || null,
    },
    select: {
      id: true, placeId: true, propertyName: true, status: true, createdAt: true,
      googlePhone: true, propertyCity: true, propertyCountry: true, address: true,
    },
  });
  return { ok: true, claim };
}

export async function listClaimsByOrg(organizationId: string) {
  return prisma.propertyClaim.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listClaims({ status, organizationId, limit = 50 }: { status?: string; organizationId?: string; limit?: number } = {}) {
  return prisma.propertyClaim.findMany({
    where: { ...(status ? { status } : {}), ...(organizationId ? { organizationId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { organization: { select: { id: true, legalName: true, businessName: true } } },
  });
}

export async function decideClaim(params: {
  id: string;
  decision: "approved" | "rejected";
  reason?: string;
  decidedBy: string;
}): Promise<{ ok: true; claim: unknown } | { ok: false; error: string }> {
  if (params.decision !== "approved" && params.decision !== "rejected") {
    return { ok: false, error: "decision must be approved|rejected" };
  }
  const claim = await prisma.propertyClaim.findUnique({ where: { id: params.id } });
  if (!claim) return { ok: false, error: "Claim not found" };
  if (claim.status !== "pending") return { ok: false, error: `Claim is already ${claim.status}` };

  if (params.decision === "approved") {
    if (!claim.verified) {
      return { ok: false, error: "Ownership is not verified. Have the owner complete phone/email verification on this claim before approving." };
    }
    const property = await prisma.property.findUnique({ where: { placeId: claim.placeId }, select: { id: true, organizationId: true } });
    if (property && property.organizationId !== claim.organizationId) {
      return { ok: false, error: "Another organization holds a Property for this placeId; reject and reconcile." };
    }
    const linked = property ?? (await prisma.property.create({
      data: {
        organizationId: claim.organizationId,
        name: claim.propertyName,
        city: claim.propertyCity,
        country: claim.propertyCountry,
        placeId: claim.placeId,
        pmsInstanceUrl: claim.address || undefined,
      },
      select: { id: true },
    }));
    // Carry acquisition attribution from the claim onto the organization when
    // the org has no source recorded yet, so a claim closes the attribution
    // chain (lead → claim → org) instead of losing the customer's origin.
    if (claim.acquisitionSource || claim.acquisitionCampaign) {
      const org = await prisma.organization.findUnique({
        where: { id: claim.organizationId },
        select: { id: true, acquisitionSource: true, acquisitionCampaign: true },
      });
      if (org && (!org.acquisitionSource || !org.acquisitionCampaign)) {
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            ...(org.acquisitionSource ? {} : { acquisitionSource: claim.acquisitionSource || null }),
            ...(org.acquisitionCampaign ? {} : { acquisitionCampaign: claim.acquisitionCampaign || null }),
          },
        });
      }
    }
    const updated = await prisma.propertyClaim.update({
      where: { id: claim.id },
      data: { status: "approved", decidedAt: new Date(), decidedBy: params.decidedBy, reason: params.reason || null, propertyId: linked.id },
    });
    return { ok: true, claim: updated };
  }

  const updated = await prisma.propertyClaim.update({
    where: { id: claim.id },
    data: { status: "rejected", decidedAt: new Date(), decidedBy: params.decidedBy, reason: params.reason || null },
  });
  return { ok: true, claim: updated };
}
