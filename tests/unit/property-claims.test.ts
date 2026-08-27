import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  __setVerificationStore,
  requestCode,
  verifyCode,
  normalizePhone,
  codeExpired,
  type VerificationStore,
} from "@/lib/saas/propertyVerification";

let seq = 0;
const created: string[] = [];

afterAll(async () => {
  for (const id of created) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  __setVerificationStore(null);
});

function memoryStore(): VerificationStore {
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

describe("PropertyClaim service", () => {
  it("blocks approval before verification, then verifies phone OTP and approves", async () => {
    const { createClaim, decideClaim } = await import("@/lib/saas/propertyClaims");
    __setVerificationStore(memoryStore());

    const org = await prisma.organization.create({ data: { legalName: `Claim Org ${++seq}` } });
    created.push(org.id);

    const placeId = `ChIJC-test-${Date.now()}-${seq}`;

    const first = await createClaim({
      organizationId: org.id,
      placeId,
      propertyName: "Test Hotel",
      googlePhone: "+1 555 0100",
      acquisitionSource: "google-ads",
      acquisitionCampaign: "summer-2026",
    });
    expect(first.ok).toBe(true);
    const claimId = (first as { ok: true; claim: { id: string } }).claim.id;

    const dup = await createClaim({
      organizationId: org.id,
      placeId,
      propertyName: "Test Hotel",
    });
    expect(dup.ok).toBe(false);
    expect("error" in dup && dup.error).toContain("already");

    const unverified = await decideClaim({ id: claimId, decision: "approved", decidedBy: "admin@test" });
    expect(unverified.ok).toBe(false);
    expect("error" in unverified && unverified.error).toContain("verified");

    const sent = await requestCode({
      claimId,
      method: "phone_otp",
      target: "+15550100",
    });
    expect(sent.ok).toBe(true);
    expect(sent.debugCode).toBeTruthy();
    const legit = sent.debugCode as string;

    const wrong = await verifyCode({
      claimId,
      method: "phone_otp",
      code: "000000",
      phone: "+15550100",
      byUser: "owner@test",
    });
    expect(wrong.ok).toBe(false);

    const mismatchedPhone = await verifyCode({
      claimId,
      method: "phone_otp",
      code: legit,
      phone: "+1999888777",
      byUser: "owner@test",
    });
    expect(mismatchedPhone.ok).toBe(false);
    expect("error" in mismatchedPhone && mismatchedPhone.error).toContain("match");

    const ok = await verifyCode({
      claimId,
      method: "phone_otp",
      code: legit,
      phone: "+1 555 0100",
      byUser: "owner@test",
    });
    expect(ok.ok).toBe(true);
    expect(ok.verified).toBe(true);
    expect(ok.verificationMethod).toBe("phone_otp");

    const decision = await decideClaim({ id: claimId, decision: "approved", decidedBy: "admin@test" });
    expect(decision.ok).toBe(true);

    const claim = await prisma.propertyClaim.findUnique({ where: { id: claimId } });
    expect(claim?.status).toBe("approved");
    expect(claim?.propertyId).toBeTruthy();
    expect(claim?.verified).toBe(true);
    expect(claim?.verificationMethod).toBe("phone_otp");
    expect(claim?.acquisitionSource).toBe("google-ads");

    const property = await prisma.property.findUnique({ where: { placeId } });
    expect(property).toBeTruthy();
    expect(property?.organizationId).toBe(org.id);

    const orgAfter = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(orgAfter?.acquisitionSource).toBe("google-ads");
    expect(orgAfter?.acquisitionCampaign).toBe("summer-2026");
  });

  it("rejects an old OTP store record, matches usage of one-time code", async () => {
    const store = memoryStore();
    __setVerificationStore(store);

    const org = await prisma.organization.create({ data: { legalName: `Verify Org ${++seq}` } });
    created.push(org.id);
    const { createClaim, decideClaim } = await import("@/lib/saas/propertyClaims");
    const claim = await createClaim({
      organizationId: org.id,
      placeId: `ChIJC-exp-${Date.now()}-${seq}`,
      propertyName: "Expire Hotel",
      googlePhone: "+1 555 2200",
    });
    const claimId = (claim as { ok: true; claim: { id: string } }).claim.id;

    const sent = await requestCode({ claimId, method: "email", target: "owner@example.com" });
    expect(sent.ok).toBe(true);
    const legit = sent.debugCode as string;

    const ok = await verifyCode({ claimId, method: "email", code: legit, byUser: "owner@test" });
    expect(ok.ok).toBe(true);

    const replay = await verifyCode({ claimId, method: "email", code: legit, byUser: "owner@test" });
    expect(replay.ok).toBe(false);

    const approval = await decideClaim({ id: claimId, decision: "approved", decidedBy: "admin@test" });
    expect(approval.ok).toBe(true);
  });
});

describe("propertyVerification helpers", () => {
  it("normalizes phone numbers and detects expiry", () => {
    expect(normalizePhone("+1 (555) 010-0100")).toBe("15550100100");
    expect(normalizePhone("001233 4567 89")).toBe("1233456789");
    expect(normalizePhone(null)).toBe("");
    expect(codeExpired({ expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(true);
    expect(codeExpired({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(codeExpired({ expiresAt: "not-a-date" })).toBe(true);
  });
});
