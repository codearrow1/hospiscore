/**
 * Customer Subscription Self-Service — integration suite (REAL DB).
 *
 * Phase H scenarios:
 *   A — mid-period UPGRADE charges a positive proration invoice
 *   B — mid-period DOWNGRADE produces a negative delta and NO credit invoice
 *   C — renewal is blocked while an outstanding invoice is unsettled
 *   D — a pending change request blocks a second (duplicate prevention)
 *
 * Plus the plan-switch approval workflow (request → approve/reject), tenant
 * isolation, RBAC, and end-of-period (scheduled) cancellation/resume.
 *
 * Harness mirrors tests/integration/financial.test.ts: an ISOLATED temp SQLite
 * file with an overridden DATABASE_URL at module top, `prisma db push`, and
 * dynamic imports — safe to run in parallel with other suites.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-subself-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "subself.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;
type Subs = typeof import("@/lib/saas/subscriptions");
type SubPlan = typeof import("@/lib/saas/subscriptionPlan");

let prisma!: PrismaClient;
let subs!: Subs;
let subPlan!: SubPlan;

const DAY = 86_400_000;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  subs = await import("@/lib/saas/subscriptions");
  subPlan = await import("@/lib/saas/subscriptionPlan");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const RESET_TABLES = [
  "payment",
  "invoice",
  "planChangeRequest",
  "subscription",
  "orgContact",
  "notification",
  "auditLog",
  "plan",
  "organization",
] as const;

beforeEach(async () => {
  for (const t of RESET_TABLES) await (prisma as never as Record<string, { deleteMany(): Promise<unknown> }>)[t].deleteMany();
});

let seq = 0;

const mkOrg = () => prisma.organization.create({ data: { legalName: `Sub Org ${++seq}` } });

/** US plans priced in USD cents: monthlyPrice/100 == charged unit amount. */
const mkPlan = (cents: number) =>
  prisma.plan.create({
    data: { name: `SubPlan ${++seq}`, slug: `subplan-${seq}`, monthlyPrice: cents, annualPrice: cents * 10, currency: "USD" },
  });

function mkSub(organizationId: string, planId: string, opts: { status?: string; unitAmount: number; ended?: boolean } = { unitAmount: 100 }) {
  const now = Date.now();
  const end = opts.ended ? new Date(now - 1 * 3_600_000) : new Date(now + 25 * DAY);
  return prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status: opts.status ?? "active",
      billingCycle: "monthly",
      mrr: opts.unitAmount * 100,
      country: "US",
      currency: "USD",
      unitAmount: opts.unitAmount,
      currentPeriodStart: new Date(now - 5 * DAY),
      currentPeriodEnd: end,
    },
  });
}

const prorationInvoices = async (subscriptionId: string) =>
  prisma.invoice.count({ where: { subscriptionId, type: "proration" } });

const openRequests = async (subscriptionId: string) =>
  prisma.planChangeRequest.count({ where: { subscriptionId, action: "subscription_change", status: "pending" } });

describe("[subscription-selfservice]", { timeout: 60_000 }, () => {
  describe("proration delta (pure)", () => {
    test("upgrade yields a positive mid-period delta", () => {
      const start = Date.now() - 5 * DAY;
      const end = Date.now() + 25 * DAY;
      const delta = subs.prorationDeltaMinor({
        oldUnitAmount: 100,
        newUnitAmount: 150,
        oldCycle: "monthly",
        newCycle: "monthly",
        periodStartMs: start,
        periodEndMs: end,
        nowMs: Date.now(),
      });
      expect(delta).toBeGreaterThan(0);
    });

    test("downgrade yields a negative delta", () => {
      const start = Date.now() - 5 * DAY;
      const end = Date.now() + 25 * DAY;
      const delta = subs.prorationDeltaMinor({
        oldUnitAmount: 150,
        newUnitAmount: 100,
        oldCycle: "monthly",
        newCycle: "monthly",
        periodStartMs: start,
        periodEndMs: end,
        nowMs: Date.now(),
      });
      expect(delta).toBeLessThan(0);
    });
  });

  describe("scenario A — mid-period upgrade proration", () => {
    test("changePlan to a more expensive plan creates a positive proration invoice", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      const updated = await subs.changePlan(sub.id, p2.id, "monthly", "test");
      expect(updated.planId).toBe(p2.id);
      const count = await prorationInvoices(sub.id);
      expect(count).toBe(1);
      const inv = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, type: "proration" } });
      expect(inv).not.toBeNull();
      expect(inv!.amount).toBeGreaterThan(0);
      expect(inv!.currency).toBe("USD");
    });
  });

  describe("scenario B — mid-period downgrade produces no credit", () => {
    test("changePlan to a cheaper plan charges nothing (no credit model yet)", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      // Start on the more expensive plan.
      const sub = await mkSub(org.id, p2.id, { unitAmount: 150 });

      const updated = await subs.changePlan(sub.id, p1.id, "monthly", "test");
      expect(updated.planId).toBe(p1.id);
      expect(updated.unitAmount).toBe(100);
      // A downgrade delta is negative → no proration invoice is created.
      expect(await prorationInvoices(sub.id)).toBe(0);
    });
  });

  describe("scenario C — renewal blocked by outstanding invoice", () => {
    test("renewSubscription rejects while an invoice is unsettled", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100, ended: true });
      await prisma.invoice.create({
        data: { organizationId: org.id, subscriptionId: sub.id, amount: 10_000, status: "issued", type: "subscription" },
      });
      await expect(subs.renewSubscription(sub.id, "test")).rejects.toThrow(/unsettled/i);
    });
  });

  describe("approval workflow + scenario D", () => {
    test("a pending request blocks a second (duplicate prevention)", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      const first = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      expect(first.ok).toBe(true);

      const second = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      if (second.ok) {
        expect.fail("expected the second request to be rejected");
      } else {
        expect(second.status).toBe(409);
      }
      expect(await openRequests(sub.id)).toBe(1);
    });

    test("approve executes canonical changePlan and applies the switch", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      const res = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      expect(res.ok).toBe(true);

      const decision = await subPlan.approveSubscriptionChange(
        (res as { requestId: string }).requestId,
        { email: "billing-admin@test", role: "platform_admin" },
      );
      expect(decision.ok).toBe(true);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.planId).toBe(p2.id);
      const req = await prisma.planChangeRequest.findUniqueOrThrow({ where: { id: (res as { requestId: string }).requestId } });
      expect(req.status).toBe("approved");
      // The switch prorates because the sub is in a revenue state.
      expect(await prorationInvoices(sub.id)).toBe(1);
    });

    test("reject leaves the subscription unchanged", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      const res = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      expect(res.ok).toBe(true);
      const id = (res as { requestId: string }).requestId;

      const decision = await subPlan.rejectSubscriptionChange(id, { email: "billing-admin@test", role: "platform_admin" }, "not the right fit");
      expect(decision.ok).toBe(true);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.planId).toBe(p1.id);
      const req = await prisma.planChangeRequest.findUniqueOrThrow({ where: { id } });
      expect(req.status).toBe("rejected");
      expect(req.rejectionReason).toContain("not the right fit");
    });

    test("approve requires SUBSCRIPTION_MANAGE (RBAC)", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      const res = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      const id = (res as { requestId: string }).requestId;

      const decision = await subPlan.approveSubscriptionChange(id, { email: "cs@test", role: "customer_success" });
      expect(decision.ok).toBe(false);
      expect(decision.status).toBe(403);
    });
  });

  describe("tenant isolation", () => {
    test("a request cannot be scoped to another org's subscription", async () => {
      const orgA = await mkOrg();
      const orgB = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const subA = await mkSub(orgA.id, p1.id, { unitAmount: 100 });

      // Caller scoped to org B tries to act on org A's subscription.
      const res = await subPlan.requestSubscriptionChange({
        organizationId: orgB.id,
        subscriptionId: subA.id,
        toPlanId: p2.id,
        requestedByEmail: "intruder@test",
      });
      if (res.ok) {
        expect.fail("expected cross-org request to be rejected");
      } else {
        expect(res.status).toBe(404);
      }
    });

    test("preview throws for another org's subscription", async () => {
      const orgA = await mkOrg();
      const orgB = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const subA = await mkSub(orgA.id, p1.id, { unitAmount: 100 });
      await expect(
        subPlan.previewSubscriptionChange({ organizationId: orgB.id, subscriptionId: subA.id, toPlanId: p2.id }),
      ).rejects.toThrow(/not found/i);
    });

    test("requester-only: another org member's email cannot withdraw our request", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const p2 = await mkPlan(15_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });
      const res = await subPlan.requestSubscriptionChange({
        organizationId: org.id,
        subscriptionId: sub.id,
        toPlanId: p2.id,
        requestedByEmail: "owner@test",
      });
      const id = (res as { requestId: string }).requestId;
      const withdraw = await subPlan.cancelSubscriptionChange(id, { email: "other@test" });
      expect(withdraw.ok).toBe(false);
      expect(withdraw.status).toBe(403);
      const state = await prisma.planChangeRequest.findUniqueOrThrow({ where: { id } });
      expect(state.status).toBe("pending");
    });
  });

  describe("scheduled cancellation + resume", () => {
    test("scheduleCancellation flags cancel-at-period-end; resume clears it", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });

      await subs.scheduleCancellation(sub.id, "test");
      let after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.cancelAtPeriodEnd).toBe(true);
      expect(after.status).toBe("active"); // still serving until period end

      await subs.resumeSubscription(sub.id, "test");
      after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.cancelAtPeriodEnd).toBe(false);
    });

    test("resume rejects when there is nothing to resume", async () => {
      const org = await mkOrg();
      const p1 = await mkPlan(10_000);
      const sub = await mkSub(org.id, p1.id, { unitAmount: 100 });
      await expect(subs.resumeSubscription(sub.id, "test")).rejects.toThrow(/Nothing to resume/i);
    });
  });
});
