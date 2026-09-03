import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  __setClaimStore,
  createClaimRequest,
  peekClaimRequest,
  redeemClaimRequest,
  claimRequestExpired,
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

async function makeRequest(opts?: {
  placeId?: string;
  propertyName?: string;
  requesterEmail?: string;
  googlePhone?: string;
  source?: string;
  campaign?: string;
}) {
  const placeId = opts?.placeId ?? `ChIJF-test-claim-${Date.now()}-${++seq}`;
  const req = await createClaimRequest({
    placeId,
    propertyName: opts?.propertyName ?? "Self Serve Hotel",
    propertyCity: "Bangkok",
    propertyCountry: "TH",
    googlePhone: opts?.googlePhone ?? "+1 555 0100",
    requesterName: "Owner Jane",
    requesterEmail: opts?.requesterEmail ?? `owner${seq}@example.com`,
    requesterPhone: "+66 2 123 4567",
    acquisitionSource: opts?.source ?? "google-ads",
    acquisitionCampaign: opts?.campaign ?? "summer-2026",
  });
  return { ...req, placeId };
}

describe("claim-request token (Phase F)", () => {
  it("mints an expiring token and peeks without burning it", async () => {
    const { token, placeId } = await makeRequest();
    expect(token).toBeTruthy();

    const peek1 = await peekClaimRequest(token);
    expect(peek1).not.toBeNull();
    expect(peek1?.placeId).toBe(placeId);
    expect(peek1?.propertyName).toBe("Self Serve Hotel");
    expect(peek1?.acquisitionSource).toBe("google-ads");

    // peek is non-destructive — still redeemable afterward
    const peek2 = await peekClaimRequest(token);
    expect(peek2?.placeId).toBe(placeId);
  });

  it("detects expired records", () => {
    expect(claimRequestExpired({ expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(true);
    expect(claimRequestExpired({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(claimRequestExpired({ expiresAt: "not-a-date" })).toBe(true);
  });

  it("rejects redemption of an unknown token", async () => {
    const result = await redeemClaimRequest({ token: "garbage-token", userId: "u1", byEmail: "x@example.com" });
    expect(result.ok).toBe(false);
    expect("error" in result && result.error).toContain("invalid or has expired");
  });
});

describe("claim-request redemption (Phase F)", () => {
  it("creates an org, binds the contact, and creates the claim on first redemption", async () => {
    const { token, placeId } = await makeRequest();
    const email = `owner-claim-${++seq}@example.com`;

    const result = await redeemClaimRequest({ token, userId: `uid-${seq}`, byEmail: email });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    created.push(result.orgId as string);

    expect(result.claimId).toBeTruthy();
    expect(result.orgId).toBeTruthy();

    const claim = await prisma.propertyClaim.findUnique({ where: { id: result.claimId } });
    expect(claim?.status).toBe("pending");
    expect(claim?.placeId).toBe(placeId);
    expect(claim?.acquisitionSource).toBe("google-ads");
    expect(claim?.acquisitionCampaign).toBe("summer-2026");
    expect(claim?.googlePhone).toBe("+1 555 0100");
    expect(claim?.organizationId).toBe(result.orgId);

    // org got acquisition attribution carried from the claim request
    const org = await prisma.organization.findUnique({ where: { id: result.orgId } });
    expect(org?.legalName).toBe("Self Serve Hotel");
    expect(org?.acquisitionSource).toBe("google-ads");

    // primary contact created
    const contacts = await prisma.orgContact.findMany({ where: { organizationId: result.orgId } });
    expect(contacts.length).toBe(1);
    expect(contacts[0].isPrimary).toBe(true);
  });

  it("is idempotent — a burned token cannot be redeemed again, and no duplicate claim or property is created", async () => {
    const { token, placeId } = await makeRequest();
    const email = `owner-idem-${++seq}@example.com`;

    const first = await redeemClaimRequest({ token, userId: `uid-${seq}`, byEmail: email });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    created.push(first.orgId as string);
    const firstClaimId = first.claimId;

    // token is single-use: second redemption fails
    const replay = await redeemClaimRequest({ token, userId: `uid-${seq}`, byEmail: email });
    expect(replay.ok).toBe(false);

    // a fresh token for the SAME org + placeId returns the existing claim (no dup)
    const secondToken = await createClaimRequest({
      placeId,
      propertyName: "Self Serve Hotel",
      requesterEmail: email,
      acquisitionSource: "google-ads",
    });
    const again = await redeemClaimRequest({ token: secondToken.token, userId: `uid-${seq}`, byEmail: email });
    expect(again.ok).toBe(true);
    expect(again.claimId).toBe(firstClaimId);
    expect(again.alreadyClaimed).toBe(true);

    const claims = await prisma.propertyClaim.count({ where: { placeId, organizationId: first.orgId } });
    expect(claims).toBe(1);
    const props = await prisma.property.count({ where: { placeId } });
    expect(props).toBe(0); // none created until approval
  });

  it("preserves canonical Property identity on approval and never duplicates the property", async () => {
    const { token, placeId } = await makeRequest();
    const email = `owner-approve-${++seq}@example.com`;

    const redeemed = await redeemClaimRequest({ token, userId: `uid-${seq}`, byEmail: email });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    created.push(redeemed.orgId as string);

    // verify
    const { requestCode, verifyCode } = await import("@/lib/saas/propertyVerification");
    const sent = await requestCode({ claimId: redeemed.claimId as string, method: "phone_otp", target: "+15550100" });
    expect(sent.ok).toBe(true);
    const code = sent.debugCode as string;
    const ok = await verifyCode({
      claimId: redeemed.claimId as string,
      method: "phone_otp",
      code,
      phone: "+1 555 0100",
      byUser: email,
    });
    expect(ok.ok).toBe(true);

    // approve
    const { decideClaim } = await import("@/lib/saas/propertyClaims");
    const decision = await decideClaim({ id: redeemed.claimId as string, decision: "approved", decidedBy: "admin@test" });
    expect(decision.ok).toBe(true);

    const claim = await prisma.propertyClaim.findUnique({ where: { id: redeemed.claimId } });
    expect(claim?.status).toBe("approved");
    expect(claim?.propertyId).toBeTruthy();

    const property = await prisma.property.findUnique({ where: { placeId } });
    expect(property?.organizationId).toBe(redeemed.orgId);

    // exactly ONE canonical property for the placeId — identity is stable
    const propCount = await prisma.property.count({ where: { placeId } });
    expect(propCount).toBe(1);
  });
});
