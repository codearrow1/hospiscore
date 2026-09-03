import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runRiskCheck } from "@/lib/saas/fraud";

let seq = 0;
const runId = Date.now();
const createdOrgs: string[] = [];
const createdAffs: string[] = [];

afterAll(async () => {
  for (const id of createdAffs) await prisma.affiliate.delete({ where: { id } }).catch(() => {});
  for (const id of createdOrgs) await prisma.organization.delete({ where: { id } }).catch(() => {});
});

describe("on-demand affiliate risk check (Phase G)", () => {
  it("flags a self-referral, persists risk, and opens exactly one open case", async () => {
    const email = `aff${runId}-${++seq}@risk.test`;
    const aff = await prisma.affiliate.create({
      data: { name: `Risk Aff ${seq}`, email, referralCode: `RSK${runId}${seq}`, status: "active" },
    });
    createdAffs.push(aff.id);

    // org whose primary contact shares the affiliate email → self-referral signal (weight 80)
    const org = await prisma.organization.create({
      data: { legalName: `Risk Org ${seq}`, contacts: { create: { name: "Owner", email, isPrimary: true } } },
    });
    createdOrgs.push(org.id);

    const first = await runRiskCheck(aff.id);
    expect(first.shouldFlag).toBe(true);
    expect(first.riskScore).toBeGreaterThanOrEqual(50);
    expect(first.signals.some((s) => s.signal === "self_referral_org")).toBe(true);
    expect(first.caseId).toBeTruthy();

    const stored = await prisma.affiliate.findUnique({ where: { id: aff.id }, select: { riskScore: true, riskReasons: true } });
    expect(stored?.riskScore).toBe(first.riskScore);
    expect(stored?.riskReasons).toBeTruthy();

    // idempotent: a re-run does not create a second open case
    const second = await runRiskCheck(aff.id);
    expect(second.shouldFlag).toBe(true);
    expect(second.caseId).toBeNull();

    const openCases = await prisma.affiliateFraudCase.count({
      where: { affiliateId: aff.id, status: { in: ["open", "investigating"] } },
    });
    expect(openCases).toBe(1);
  });

  it("clears risk without a case when nothing is flagged", async () => {
    const email = `clean${runId}-${++seq}@risk.test`;
    const aff = await prisma.affiliate.create({
      data: { name: `Clean Aff ${seq}`, email, referralCode: `CLN${runId}${seq}`, status: "active" },
    });
    createdAffs.push(aff.id);

    const res = await runRiskCheck(aff.id);
    expect(res.riskScore).toBe(0);
    expect(res.shouldFlag).toBe(false);
    expect(res.caseId).toBeNull();

    const cases = await prisma.affiliateFraudCase.count({ where: { affiliateId: aff.id } });
    expect(cases).toBe(0);
  });
});
