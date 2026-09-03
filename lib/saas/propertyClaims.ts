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
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSetting } from "@/lib/settings/resolver";
import { createOrganization } from "@/lib/saas/organizations";
import { bindPortalIdentity } from "@/lib/saas/portalLinks";

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
  }).catch((err: unknown) => {
    // Unique-constraint race: two identical claim creates for the same
    // org+placeId can only happen under true concurrency (both passed the
    // findUnique check above before either inserted). Collapse to "already
    // claimed by your organization" rather than creating a duplicate row.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: unknown }).code === "P2002"
    ) {
      throw new Error("ALREADY_CLAIMED_CONCURRENT");
    }
    throw err;
  });
  return { ok: true, claim };
}

export async function listClaimsByOrg(organizationId: string) {
  return prisma.propertyClaim.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Self-service claim requests (Phase F).
//
// A prospective owner can start a property claim BEFORE they have an account:
//  - POST /api/properties/claim/start mints a one-time, expiring, hashed
//    property-claim request token. The token is the ONLY thing that can later
//    create a claim on redemption — it carries the listing identity and the
//    requester's contact details as resolved server-side at mint time.
//  - On redemption (register/login with ?claim=token) the server creates a
//    minimal Organization + primary OrgContact + the canonical PropertyClaim.
//    The org id / contact id / claim are ALL server-created — never derived
//    from browser-supplied ids.
//
// This extends the single canonical PropertyClaim system. Redemption reuses
// createClaim/decideClaim/requestCode/verifyCode; it introduces no second
// claim model and never mutates an existing Property's identity.
// ---------------------------------------------------------------------------

export interface ClaimRequestRecord {
  kind: "property_claim_request";
  placeId: string;
  propertyName: string;
  propertyCity?: string | null;
  propertyCountry?: string | null;
  address?: string | null;
  googlePhone?: string | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  acquisitionSource?: string | null;
  acquisitionCampaign?: string | null;
  expiresAt: string;
}

const CLAIM_REQUESTS_KEY = "property_claim_requests";
const CLAIM_REQUEST_TTL_MS = 60 * 60_000;

export interface ClaimRequestStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

let claimStoreOverride: ClaimRequestStore | null = null;

/** Test seam: pass a fake store, or null to restore the default Prisma-backed one. */
export function __setClaimStore(s: ClaimRequestStore | null): void {
  claimStoreOverride = s;
}

async function readClaimRequests(): Promise<Record<string, ClaimRequestRecord>> {
  let raw: unknown;
  if (claimStoreOverride) {
    raw = await claimStoreOverride.read(CLAIM_REQUESTS_KEY);
  } else {
    try {
      const row = await prisma.systemSetting.findUnique({ where: { key: CLAIM_REQUESTS_KEY } });
      raw = row?.value ?? {};
    } catch {
      raw = {};
    }
  }
  return (raw ?? {}) as Record<string, ClaimRequestRecord>;
}

async function writeClaimRequests(map: Record<string, ClaimRequestRecord>): Promise<void> {
  if (claimStoreOverride) {
    await claimStoreOverride.write(CLAIM_REQUESTS_KEY, map);
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: CLAIM_REQUESTS_KEY },
    update: { value: map as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    create: { key: CLAIM_REQUESTS_KEY, value: map as unknown as Prisma.InputJsonValue, updatedByEmail: "system" },
  });
}

export function hashRequestToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function claimRequestExpired(rec: Pick<ClaimRequestRecord, "expiresAt">, now = Date.now()): boolean {
  const t = Date.parse(rec.expiresAt);
  return !Number.isFinite(t) || t <= now;
}

async function getClaimRequestTtl(): Promise<number> {
  try {
    return await resolveSetting<number>("portal_claim_ttl_ms").then((v) => (v > 0 ? v : CLAIM_REQUEST_TTL_MS));
  } catch {
    return CLAIM_REQUEST_TTL_MS;
  }
}

export interface ClaimRequestInput {
  placeId: string;
  propertyName: string;
  propertyCity?: string | null;
  propertyCountry?: string | null;
  address?: string | null;
  googlePhone?: string | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  acquisitionSource?: string | null;
  acquisitionCampaign?: string | null;
}

/**
 * Mint a one-time property-claim request token. Only the SHA-256 hash is
 * stored; the plaintext is returned exactly once. Caller is responsible for
 * resolving the listing identity server-side and passing it in (never from the
 * client).
 */
export async function createClaimRequest(input: ClaimRequestInput): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const rec: ClaimRequestRecord = {
    kind: "property_claim_request",
    placeId: input.placeId,
    propertyName: input.propertyName,
    propertyCity: input.propertyCity || null,
    propertyCountry: input.propertyCountry || null,
    address: input.address || null,
    googlePhone: input.googlePhone || null,
    requesterName: input.requesterName?.trim() || undefined,
    requesterEmail: input.requesterEmail?.trim().toLowerCase() || undefined,
    requesterPhone: input.requesterPhone?.trim() || undefined,
    acquisitionSource: input.acquisitionSource || null,
    acquisitionCampaign: input.acquisitionCampaign || null,
    expiresAt: new Date(Date.now() + (await getClaimRequestTtl())).toISOString(),
  };
  const map = await readClaimRequests();
  for (const [h, r] of Object.entries(map)) {
    if (claimRequestExpired(r)) delete map[h];
  }
  map[hashRequestToken(token)] = rec;
  await writeClaimRequests(map);
  return { token, expiresAt: rec.expiresAt };
}

/** Non-destructive peek — does NOT burn the token. */
export async function peekClaimRequest(token: string): Promise<ClaimRequestRecord | null> {
  const requests = await readClaimRequests();
  const rec = requests[hashRequestToken(token)] as ClaimRequestRecord | undefined;
  if (!rec || claimRequestExpired(rec)) return null;
  return rec;
}

export interface RedeemClaimRequestResult {
  ok: boolean;
  error?: string;
  orgId?: string;
  contactId?: string;
  claimId?: string;
  /** true when the claim already existed for this org+placeId (idempotent). */
  alreadyClaimed?: boolean;
}

/**
 * Redeem a property-claim request token for a signed-in user. Creates (on
 * first use) a minimal Organization + primary OrgContact bound to the user, then
 * creates the canonical PropertyClaim. Idempotent: a second redemption for the
 * same org+placeId returns the existing claim without duplicating.
 *
 * The org id / contact id / claim id are all server-created here — the caller
 * only supplies the authenticated user (id/email), never browser-submitted ids.
 */
export async function redeemClaimRequest(params: {
  token: string;
  userId: string;
  byEmail: string;
}): Promise<RedeemClaimRequestResult> {
  const req = await peekClaimRequest(params.token);
  if (!req) return { ok: false, error: "This claim token is invalid or has expired. Go back and start again." };
  if (!req.requesterEmail) return { ok: false, error: "Claim token is missing the requester email. Start the claim again." };

  // 1. Find the user's existing org (explicit binding first), else email contact.
  let orgId: string | null = null;
  let contactId: string | null = null;
  for (const lookup of ["binding", "email"] as const) {
    let found: { organizationId: string; contactId: string } | null = null;
    if (lookup === "binding") {
      const { resolveOrgForUser } = await import("@/lib/saas/portalAccess");
      const resolved = await resolveOrgForUser({ id: params.userId, email: params.byEmail });
      if (resolved) found = { organizationId: resolved.organizationId, contactId: resolved.contactId };
    } else {
      const contact = await prisma.orgContact.findFirst({
        where: { email: params.byEmail.toLowerCase(), organization: { status: { not: "cancelled" } } },
        orderBy: { isPrimary: "desc" },
        select: { id: true, organizationId: true },
      });
      if (contact) found = { organizationId: contact.organizationId, contactId: contact.id };
    }
    if (found) {
      orgId = found.organizationId;
      contactId = found.contactId;
      break;
    }
  }

  // 2. Otherwise create (or safely reuse) a minimal org + primary contact.
  //    Phase G: two concurrent redemptions by the same verified claimant can
  //    both reach this branch (both failed the read lookups above before either
  //    wrote). A scoped DB unique key on Organization.claimantKey (sha256 of the
  //    normalized claimant email) collapses them into ONE org: the slower caller
  //    catches P2002 and reuses the winner's org instead of creating an orphan.
  const claimantEmail = (req.requesterEmail ?? params.byEmail).trim().toLowerCase();
  const claimantKey = createHash("sha256").update(claimantEmail).digest("hex");

  if (!orgId || !contactId) {
    // A concurrent redemption may already have created the org for this key.
    const byKey = await prisma.organization.findUnique({
      where: { claimantKey },
      select: { id: true },
    });
    if (byKey) {
      orgId = byKey.id;
      const primary = await prisma.orgContact.findFirst({
        where: { organizationId: orgId, isPrimary: true },
        select: { id: true },
      });
      contactId = primary?.id ?? null;
    } else {
      let createdOrgId: string | null = null;
      try {
        const org = await createOrganization({
          legalName: req.propertyName,
          country: req.propertyCountry || undefined,
          acquisitionSource: req.acquisitionSource || undefined,
          acquisitionCampaign: req.acquisitionCampaign || undefined,
          primaryContact: {
            name: req.requesterName || req.propertyName,
            email: claimantEmail,
            phone: req.requesterPhone || undefined,
          },
          claimantKey,
        });
        createdOrgId = org.id;
        orgId = org.id;
        const primary = org.contacts?.[0];
        contactId = primary?.id ?? null;
      } catch (err) {
        // Unique-constraint race on claimantKey: another request created the
        // org for this key between our find and create. Reuse their org.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: unknown }).code === "P2002"
        ) {
          const winner = await prisma.organization.findUnique({
            where: { claimantKey },
            select: { id: true },
          });
          if (!winner) return { ok: false, error: "Could not create an organization for this claim." };
          createdOrgId = winner.id;
          orgId = winner.id;
        } else {
          throw err;
        }
      }
      const primary = await prisma.orgContact.findFirst({
        where: { organizationId: createdOrgId as string, isPrimary: true },
        select: { id: true },
      });
      contactId = primary?.id ?? null;
    }
    if (contactId) {
      await bindPortalIdentity({ kind: "org_contact", refId: contactId, userId: params.userId, boundBy: params.byEmail });
    }
  }

  if (!orgId) return { ok: false, error: "Could not create an organization for this claim." };
  if (!contactId) return { ok: false, error: "Could not create a contact for this claim." };

  // 3. Create (or reuse) the canonical claim, preserving attribution + dedupe.
  const existingClaim = await prisma.propertyClaim.findUnique({
    where: { placeId_organizationId: { placeId: req.placeId, organizationId: orgId } },
    select: { id: true },
  });
  if (existingClaim) {
    // Burn the token even on idempotent redeem — it was successfully used.
    await burnClaimRequest(params.token);
    return { ok: true, orgId, contactId, claimId: existingClaim.id, alreadyClaimed: true };
  }

  const result = await createClaim({
    organizationId: orgId,
    placeId: req.placeId,
    propertyName: req.propertyName,
    propertyCity: req.propertyCity || undefined,
    propertyCountry: req.propertyCountry || undefined,
    address: req.address || undefined,
    googlePhone: req.googlePhone,
    requesterName: req.requesterName,
    requesterEmail: req.requesterEmail,
    requesterPhone: req.requesterPhone,
    acquisitionSource: req.acquisitionSource || undefined,
    acquisitionCampaign: req.acquisitionCampaign || undefined,
    createdById: params.userId,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "ALREADY_CLAIMED_CONCURRENT") {
      return { ok: false as const, error: "claim_race_already_claimed" };
    }
    throw err;
  });
  if (!result.ok) {
    if (result.error === "claim_race_already_claimed") {
      // Lost the create race but the row exists — treat as already claimed.
      const existing = await prisma.propertyClaim.findUnique({
        where: { placeId_organizationId: { placeId: req.placeId, organizationId: orgId } },
        select: { id: true },
      });
      await burnClaimRequest(params.token);
      return existing
        ? { ok: true, orgId, contactId, claimId: existing.id, alreadyClaimed: true }
        : { ok: false, error: "This claim already exists" };
    }
    if (result.error.includes("already claimed by another organization")) {
      return { ok: false, error: "This listing is already claimed by another organization." };
    }
    return { ok: false, error: result.error };
  }
  const claim = result.claim as { id: string };
  await burnClaimRequest(params.token);
  return { ok: true, orgId, contactId, claimId: claim.id };
}

/** Burn (delete) a claim request token from the store. */
async function burnClaimRequest(token: string): Promise<void> {
  const h = hashRequestToken(token);
  const map = await readClaimRequests();
  if (map[h]) {
    delete map[h];
    await writeClaimRequests(map);
  }
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
