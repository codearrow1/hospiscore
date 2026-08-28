import { describe, it, expect, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createOrganization } from "@/lib/saas/organizations";
import { customerChecklist, getOnboardingStatus } from "@/lib/saas/onboarding";

let seq = 0;
const runId = Date.now();
const DAY = 86_400_000;
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await prisma.organization.delete({ where: { id } }).catch(() => {});
});

const claimantKeyFor = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

async function seedFullOrg() {
  const email = `owner${runId}-${++seq}@ob-example.com`;
  const org = await createOrganization({
    legalName: `Onboard Org ${seq}`,
    country: "TH",
    primaryContact: { name: "Owner", email, phone: "+66 2 123 4567" },
    claimantKey: claimantKeyFor(email),
  });
  created.push(org.id);
  await prisma.orgContact.create({ data: { organizationId: org.id, name: "Co-owner", email: `co-${runId}-${seq}@ob-example.com`, role: "tech", isPrimary: false } });
  await prisma.property.create({ data: { organizationId: org.id, name: "Onboard Hotel", city: "Bangkok", country: "TH", placeId: `place:ob-${runId}-${seq}` } });
  await prisma.propertyClaim.create({
    data: {
      organizationId: org.id,
      placeId: `place:obc-${runId}-${seq}`,
      propertyName: "Onboard Hotel",
      status: "approved",
      requesterEmail: email,
      verified: true,
      verifiedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  const plan = await prisma.plan.create({ data: { name: `ObPlan ${runId}-${seq}`, slug: `obplan-${runId}-${seq}`, monthlyPrice: 9900, annualPrice: 99000 } });
  const sub = await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planId: plan.id,
      status: "trial",
      mrr: 10000,
      currentPeriodStart: new Date(Date.now() - 5 * DAY),
      currentPeriodEnd: new Date(Date.now() + 9 * DAY),
      trialEndsAt: new Date(Date.now() + 9 * DAY),
    },
  });
  await prisma.invoice.create({ data: { organizationId: org.id, subscriptionId: sub.id, amount: 9900, status: "issued", type: "subscription", dueAt: new Date(Date.now() + 7 * DAY) } });
  return { org, email };
}

describe("onboarding status + org dedup (Phase G)", () => {
  it("customerChecklist exposes the derived activation auto-step", async () => {
    const { org } = await seedFullOrg();
    const steps = await customerChecklist(org.id);
    const keys = steps.map((s) => s.key);
    expect(keys).toContain("activation");
    const activation = steps.find((s) => s.key === "activation");
    expect(activation?.source).toBe("auto");
    expect(activation?.done).toBe(true);
  });

  it("getOnboardingStatus reflects real state and flips to complete", async () => {
    const { org } = await seedFullOrg();
    const ready = await getOnboardingStatus(org.id);
    expect(ready.organizationReady).toBe(true);
    expect(ready.propertyReady).toBe(true);
    expect(ready.claimReady).toBe(true);
    expect(ready.teamReady).toBe(true);
    expect(ready.activationReady).toBe(true);
    expect(ready.billingReady).toBe(true);
    expect(ready.complete).toBe(true);
  });

  it("getOnboardingStatus reports incomplete for a freshly-claimed empty org", async () => {
    const email = `bare${runId}-${++seq}@ob-example.com`;
    const org = await createOrganization({
      legalName: `Bare Org ${seq}`,
      primaryContact: { name: "Owner", email },
      claimantKey: claimantKeyFor(email),
    });
    created.push(org.id);
    await prisma.propertyClaim.create({
      data: { organizationId: org.id, placeId: `place:bare-${runId}-${seq}`, propertyName: "Bare Hotel", status: "approved", requesterEmail: email, verified: true, verifiedAt: new Date(), decidedAt: new Date() },
    });
    const status = await getOnboardingStatus(org.id);
    expect(status.claimReady).toBe(true);
    expect(status.organizationReady).toBe(true);
    expect(status.propertyReady).toBe(false);
    expect(status.teamReady).toBe(false);
    expect(status.activationReady).toBe(false);
    expect(status.complete).toBe(false);
  });

  it("Organization.claimantKey is UNIQUE: concurrent same-key creates collapse to one org", async () => {
    const email = `dup${runId}-${++seq}@ob-example.com`;
    const key = claimantKeyFor(email);
    const mk = () =>
      createOrganization({ legalName: `Dup Org ${seq}`, primaryContact: { name: "Owner", email }, claimantKey: key });
    const results = await Promise.allSettled([mk(), mk()]);
    const orgRows = await prisma.organization.findMany({ where: { claimantKey: key } });
    expect(orgRows.length).toBe(1);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err?.code).toBe("P2002");
    created.push(orgRows[0].id);
  });
});
