import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  __setClaimStore,
  createClaimRequest,
  redeemClaimRequest,
  type ClaimRequestStore,
} from "@/lib/saas/propertyClaims";

let seq = 0;
const created: string[] = [];

afterAll(async () => {
  for (const id of created) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  __setClaimStore(null);
});

beforeEach(() => {
  __setClaimStore(memoryStore());
});

function memoryStore(): ClaimRequestStore {
  const map: Record<string, unknown> = {};
  return {
    async read(k) {
      return map[k];
    },
    async write(k, v) {
      map[k] = v;
    },
  };
}

describe("claim concurrency (Phase F / Phase 35)", () => {
  it("two orgs claiming the same listing create two distinct claims and approval of one never corrupts the other", async () => {
    const { createClaim, decideClaim } = await import("@/lib/saas/propertyClaims");
    const placeId = `ChIJD-conc-${Date.now()}-${++seq}`;

    const orgA = await prisma.organization.create({ data: { legalName: `Conc Org A ${++seq}` } });
    created.push(orgA.id);
    const orgB = await prisma.organization.create({ data: { legalName: `Conc Org B ${++seq}` } });
    created.push(orgB.id);

    const claimA = await createClaim({
      organizationId: orgA.id,
      placeId,
      propertyName: "Rival Hotel",
      googlePhone: "+1 555 0100",
    });
    expect(claimA.ok).toBe(true);
    const claimAId = (claimA as { ok: true; claim: { id: string } }).claim.id;

    const claimB = await createClaim({
      organizationId: orgB.id,
      placeId,
      propertyName: "Rival Hotel",
    });
    expect(claimB.ok).toBe(true);
    const claimBId = (claimB as { ok: true; claim: { id: string } }).claim.id;

    // both stored safely, distinct
    const rows = await prisma.propertyClaim.findMany({ where: { placeId } });
    expect(rows.length).toBe(2);
    expect(new Set(rows.map((r) => r.organizationId)).size).toBe(2);

    // approve A: creates the canonical property for A
    const { requestCode, verifyCode } = await import("@/lib/saas/propertyVerification");
    const sentA = await requestCode({ claimId: claimAId, method: "phone_otp", target: "+15550100" });
    expect(sentA.ok).toBe(true);
    const codeA = (sentA as { debugCode?: string }).debugCode as string;
    await verifyCode({ claimId: claimAId, method: "phone_otp", code: codeA, phone: "+1 555 0100", byUser: "a@test" });

    const decidedA = await decideClaim({ id: claimAId, decision: "approved", decidedBy: "admin@test" });
    expect(decidedA.ok).toBe(true);

    const propertyA = await prisma.property.findUnique({ where: { placeId } });
    expect(propertyA?.organizationId).toBe(orgA.id);

    // B's claim is untouched and still pending
    const claimBAfter = await prisma.propertyClaim.findUnique({ where: { id: claimBId } });
    expect(claimBAfter?.status).toBe("pending");

    // B cannot approve against org A's property — decideClaim is guarded
    const sentB = await requestCode({ claimId: claimBId, method: "phone_otp", target: "+15550100" });
    const codeB = (sentB as { debugCode?: string }).debugCode as string;
    await verifyCode({ claimId: claimBId, method: "phone_otp", code: codeB, phone: "+1 555 0100", byUser: "b@test" });
    const decidedB = await decideClaim({ id: claimBId, decision: "approved", decidedBy: "admin@test" });
    // guarded: another org holds the property for this placeId
    expect(decidedB.ok).toBe(false);

    // exactly ONE canonical property for the placeId regardless of competing claims
    const propCount = await prisma.property.count({ where: { placeId } });
    expect(propCount).toBe(1);
  });

  it("two parallel redemptions of the same claim token yield a single claim and org", async () => {
    const placeId = `ChIJD-raceedge-${Date.now()}-${++seq}`;
    const request = await createClaimRequest({
      placeId,
      propertyName: "Race Edge Hotel",
      requesterEmail: `race-${seq}@example.com`,
      acquisitionSource: "organic",
    });

    const [r1, r2] = await Promise.all([
      redeemClaimRequest({ token: request.token, userId: `race-uid-${seq}`, byEmail: `race-${seq}@example.com` }),
      redeemClaimRequest({ token: request.token, userId: `race-uid-${seq}`, byEmail: `race-${seq}@example.com` }),
    ]);

    const okResults = [r1, r2].filter(
      (r): r is Extract<typeof r, { ok: true }> => r.ok === true,
    ) as Array<{ ok: true; orgId?: string; claimId?: string }>;
    expect(okResults.length).toBeGreaterThanOrEqual(1);

    // exactly one claim row for the placeId regardless of the orphaned-org race
    const claims = await prisma.propertyClaim.findMany({ where: { placeId } });
    expect(claims.length).toBe(1);

    // orphan-org invariant: exactly ONE canonical org for the claimant key,
    // and every successful redemption points at that same org (no orphan, no
    // duplicate organization even under true concurrency).
    const orgIds = okResults.map((r) => r.orgId as string).filter(Boolean);
    expect(new Set(orgIds).size).toBe(1);
    const claimantEmail = `race-${seq}@example.com`;
    const claimantKey = createHash("sha256").update(claimantEmail).digest("hex");
    const keyedOrgs = await prisma.organization.findMany({ where: { claimantKey } });
    expect(keyedOrgs.length).toBe(1);

    const winnerOrg = orgIds[0];
    if (winnerOrg) {
      const orgClaims = await prisma.propertyClaim.count({ where: { placeId, organizationId: winnerOrg } });
      expect(orgClaims).toBe(1);
      created.push(winnerOrg);
    }
  });
});
