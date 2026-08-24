/**
 * Financial integration suite — REAL database, REAL Prisma transactions.
 *
 * Harness (documented design):
 * - Isolated temp SQLite file created under the OS tmpdir; DATABASE_URL is
 *   overridden at module top BEFORE any app import, so the PrismaClient
 *   singleton binds to the temp DB (vitest isolates module registries per
 *   test file, so this never leaks into other suites or the dev DB).
 * - Schema comes straight from prisma/schema.prisma via one
 *   `prisma db push --skip-generate` (deterministic, offline).
 * - All app-code modules are imported dynamically inside beforeAll.
 * - Every test starts from an empty DB (FK-safe deleteMany chain).
 * - Concurrency tests fire REAL parallel promises and assert persisted
 *   state — never call results — tolerating a contender losing with any
 *   rejection (business rule or SQLite serialization).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";

// ---- Harness bootstrap (must precede every @/ import) --------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-fin-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "fin.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;
type Gateway = typeof import("@/lib/saas/gateway");
type Subs = typeof import("@/lib/saas/subscriptions");
type Usage = typeof import("@/lib/saas/usageBilling");
type Payouts = typeof import("@/lib/saas/payouts");
type Dunning = typeof import("@/lib/saas/dunning");

let prisma!: PrismaClient;
let gateway!: Gateway;
let subs!: Subs;
let coupons!: typeof import("@/lib/saas/coupons");
let usage!: Usage;
let payouts!: Payouts;
let dunning!: Dunning;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  gateway = await import("@/lib/saas/gateway");
  subs = await import("@/lib/saas/subscriptions");
  coupons = await import("@/lib/saas/coupons");
  usage = await import("@/lib/saas/usageBilling");
  payouts = await import("@/lib/saas/payouts");
  dunning = await import("@/lib/saas/dunning");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const RESET_TABLES = [
  "payment",
  "invoice",
  "dunningCase",
  "usageRecord",
  "automationEvent",
  "couponRedemption",
  "coupon",
  "affiliatePayout",
  "affiliateCommission",
  "affiliate",
  "subscription",
  "systemSetting",
  "plan",
  "organization",
  "auditLog",
] as const;

beforeEach(async () => {
  for (const t of RESET_TABLES) await (prisma as never as Record<string, { deleteMany(): Promise<unknown> }>)[t].deleteMany();
});

// ---- Factories ------------------------------------------------------------
let seq = 0;
const DAY = 86_400_000;

const mkOrg = () => prisma.organization.create({ data: { legalName: `Fin Org ${++seq}` } });

const mkPlan = (monthlyPrice: number) =>
  prisma.plan.create({
    data: { name: `FinPlan ${++seq}`, slug: `finplan-${seq}`, monthlyPrice, annualPrice: monthlyPrice * 10 },
  });

function mkSub(organizationId: string, planId: string, opts: { mrr?: number; status?: string; endedHoursAgo?: number; cycle?: string } = {}) {
  const end = new Date(Date.now() - (opts.endedHoursAgo ?? 1) * 3_600_000);
  return prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status: opts.status ?? "active",
      billingCycle: opts.cycle ?? "monthly",
      mrr: opts.mrr ?? 10_000,
      currentPeriodStart: new Date(end.getTime() - 30 * DAY),
      currentPeriodEnd: end,
    },
  });
}

const mkInvoice = (organizationId: string, amount: number, subscriptionId?: string) =>
  prisma.invoice.create({
    data: { organizationId, subscriptionId: subscriptionId ?? null, amount, status: "issued", type: "subscription", dueAt: new Date(Date.now() + 7 * DAY) },
  });

const mkAffiliate = () =>
  prisma.affiliate.create({
    data: { name: `FinAff ${++seq}`, email: `fin-${seq}@fin.test`, referralCode: `FIN${seq}${Date.now()}`, status: "active" },
  });

const mkCommission = (affiliateId: string, amount: number, paidAmount = 0, status = "payable") =>
  prisma.affiliateCommission.create({
    data: { affiliateId, amount, paidAmount, status, model: "percent_first", createdAt: new Date(Date.now() + seq++ * 1_000) },
  });

const paySucceeded = (invoiceId: string) => prisma.payment.aggregate({ where: { invoiceId, status: "succeeded" }, _sum: { amount: true } });

const outstandingOf = async (invoiceId: string) => {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  return inv.amount - ((await paySucceeded(invoiceId))._sum.amount ?? 0);
};

const pay = (organizationId: string, invoiceId: string, amount: number, extra: Partial<Parameters<Gateway["recordPayment"]>[0]> = {}) =>
  gateway.recordPayment({ organizationId, invoiceId, amount, actorEmail: "fin-test", ...extra });

// ===========================================================================
describe("[financial-integration]", { timeout: 60_000 }, () => {
  // ---- PHASE 2: M-02 payments -------------------------------------------
  describe("payments (M-02)", () => {
    test("exact payment settles the invoice", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await pay(org.id, inv.id, 10_000);
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      expect(after.status).toBe("paid");
      expect(after.paidAt).not.toBeNull();
      expect((await paySucceeded(inv.id))._sum.amount).toBe(10_000);
    });

    test("overpayment rejected, nothing persisted, invoice unchanged", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await expect(pay(org.id, inv.id, 10_101)).rejects.toThrow(/exceeds/i);
      expect(await prisma.payment.count()).toBe(0);
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      expect(after.status).toBe("issued");
      expect(await outstandingOf(inv.id)).toBe(10_000);
    });

    test("partial payment leaves unsettled remainder", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await pay(org.id, inv.id, 4_000);
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      expect(after.status).toBe("partially_paid");
      expect(await outstandingOf(inv.id)).toBe(6_000);
    });

    test("multiple partial payments 40+30+30 settle exactly", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await pay(org.id, inv.id, 4_000);
      await pay(org.id, inv.id, 3_000);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("partially_paid");
      await pay(org.id, inv.id, 3_000);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
      expect(await outstandingOf(inv.id)).toBe(0);
    });

    test("mid-transaction failure writes no partial financial state", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.payment.create({ data: { organizationId: org.id, invoiceId: inv.id, amount: 4_000, status: "succeeded" } });
          await tx.invoice.update({ where: { id: inv.id }, data: { status: "partially_paid" } });
          throw new Error("boom-after-write");
        }),
      ).rejects.toThrow("boom-after-write");
      expect(await prisma.payment.count()).toBe(0);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("issued");
    });

    test("concurrent payments can never overpay the invoice", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      const results = await Promise.allSettled([pay(org.id, inv.id, 7_000), pay(org.id, inv.id, 7_000)]);
      const persistedTotal = (await paySucceeded(inv.id))._sum.amount ?? 0;
      expect(persistedTotal).toBeLessThanOrEqual(10_000);
      // With serialized writers exactly one contender wins here.
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      // The remaining balance is still collectable.
      await pay(org.id, inv.id, 10_000 - persistedTotal);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });

    test("zero-amount invoice settles on a zero payment", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 0);
      await pay(org.id, inv.id, 0);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });
  });

  // ---- PHASE 3: M-05 renewal ---------------------------------------------
  describe("renewal (M-05)", () => {
    test("clean renewal creates exactly one next-period invoice and extends atomically", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id, { endedHoursAgo: 2 });
      const res = await subs.renewSubscription(sub.id, "fin-test");
      expect(res.renewalInvoiceId).toBeTruthy();
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.status).toBe("active");
      expect(after.currentPeriodStart!.getTime()).toBe(sub.currentPeriodEnd.getTime());
      expect(after.currentPeriodEnd.getTime()).toBeGreaterThan(sub.currentPeriodEnd.getTime());
      const invoices = await prisma.invoice.findMany({ where: { subscriptionId: sub.id } });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].amount).toBe(10_000);
      expect(invoices[0].type).toBe("subscription");
    });

    test.each([
      ["partial outstanding", 4_000],
      ["fully outstanding", 0],
    ])("renewal blocked with %s invoice", async (_name, paidPart) => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id);
      const inv = await mkInvoice(org.id, 10_000, sub.id);
      if (paidPart > 0) await pay(org.id, inv.id, paidPart);
      await expect(subs.renewSubscription(sub.id, "fin-test")).rejects.toThrow(/unsettled/i);
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.currentPeriodEnd.getTime()).toBe(sub.currentPeriodEnd.getTime());
      expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(1);
    });

    test.each([
      ["cancelled", "cancelled"],
      ["expired", "expired"],
      ["paused", "paused"],
      ["suspended", "suspended"],
    ])("renewal refuses %s subscriptions", async (_name, status) => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id, { status });
      await expect(subs.renewSubscription(sub.id, "fin-test")).rejects.toThrow(/Cannot renew/i);
      expect(await prisma.invoice.count()).toBe(0);
    });

    test("repeated renewal calls cannot duplicate the next-period invoice", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id);
      await subs.renewSubscription(sub.id, "fin-test");
      await expect(subs.renewSubscription(sub.id, "fin-test")).rejects.toThrow(/has not ended/i);
      expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(1);
    });

    test("failure inside renewal rolls back invoice AND period extension", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id);
      const coupon = await coupons.createCoupon({ code: `EXH${seq}`, type: "fixed", value: 500, duration: "repeating", months: 1 });
      await prisma.couponRedemption.create({
        data: { couponId: coupon.id, organizationId: org.id, amountDiscounted: 500, timesApplied: 1 },
      });
      // repeating coupon exhausted → applyCoupon(renewal) throws INSIDE the
      // renewal transaction → invoice + extension must roll back together.
      await expect(subs.renewSubscription(sub.id, "fin-test")).rejects.toThrow(/already redeemed/i);
      expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(0);
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.currentPeriodEnd.getTime()).toBe(sub.currentPeriodEnd.getTime());
      expect((await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: coupon.id } })).timesApplied).toBe(1);
    });

    test("forever coupon re-applies on renewal with correct discount", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id);
      const coupon = await coupons.createCoupon({ code: `FRV${seq}`, type: "fixed", value: 1_500, duration: "forever" });
      await prisma.couponRedemption.create({
        data: { couponId: coupon.id, organizationId: org.id, amountDiscounted: 1_500, timesApplied: 1 },
      });
      const res = await subs.renewSubscription(sub.id, "fin-test");
      expect(res.renewalInvoiceAmount).toBe(8_500);
      const redemption = await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: coupon.id } });
      expect(redemption.timesApplied).toBe(2);
      expect(redemption.amountDiscounted).toBe(3_000);
    });

    test("concurrent renewals produce exactly one invoice and one extension", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id);
      const results = await Promise.allSettled([subs.renewSubscription(sub.id), subs.renewSubscription(sub.id)]);
      const ok = results.filter((r) => r.status === "fulfilled");
      expect(ok).toHaveLength(1);
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      const expectedEnd = new Date(sub.currentPeriodEnd);
      expectedEnd.setMonth(expectedEnd.getMonth() + 1);
      expect(after.currentPeriodEnd.getTime()).toBe(expectedEnd.getTime());
      expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(1);
    });
  });

  // ---- PHASE 4: M-07 coupons ----------------------------------------------
  describe("coupons (M-07)", () => {
    const amount = 10_000;
    async function setup(duration: "once" | "repeating" | "forever", months?: number) {
      const org = await mkOrg();
      const c = await coupons.createCoupon({
        code: `PH4${++seq}`,
        type: "fixed",
        value: 500,
        duration,
        ...(months != null ? { months } : {}),
      });
      return { org, c };
    }

    test("once: initial applies, renewal does not", async () => {
      const { org, c } = await setup("once");
      const r1 = await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "new" });
      expect(r1.discount).toBe(500);
      await expect(coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" })).rejects.toThrow();
    });

    test("repeating 1 month: initial applied, renewal #1 rejected", async () => {
      const { org, c } = await setup("repeating", 1);
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "new" });
      await expect(coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" })).rejects.toThrow();
    });

    test("repeating 2 months: initial + renewal #1 applied, renewal #2 rejected", async () => {
      const { org, c } = await setup("repeating", 2);
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "new" });
      const r = await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" });
      expect(r.discount).toBe(500);
      await expect(coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" })).rejects.toThrow();
      const red = await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: c.id } });
      expect(red.timesApplied).toBe(2);
    });

    test("repeating 3 months: initial + #1 + #2 applied, #3 rejected", async () => {
      const { org, c } = await setup("repeating", 3);
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "new" });
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" });
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" });
      await expect(coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" })).rejects.toThrow();
      const red = await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: c.id } });
      expect(red.timesApplied).toBe(3);
    });

    test("forever: repeated renewals keep applying", async () => {
      const { org, c } = await setup("forever");
      await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "new" });
      for (let i = 2; i <= 4; i++) {
        await coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" });
        expect((await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: c.id } })).timesApplied).toBe(i);
      }
    });

    test("duplicate/concurrent applications cannot increment timesApplied twice", async () => {
      const { org, c } = await setup("repeating", 2);
      await prisma.couponRedemption.create({
        data: { couponId: c.id, organizationId: org.id, amountDiscounted: 500, timesApplied: 1 },
      });
      const results = await Promise.allSettled(
        Array.from({ length: 3 }, () => coupons.applyCoupon({ code: c.code, organizationId: org.id, amount, mode: "renewal" })),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const red = await prisma.couponRedemption.findFirstOrThrow({ where: { couponId: c.id } });
      expect(red.timesApplied).toBe(2);
      expect(red.amountDiscounted).toBe(1_000);
    });
  });

  // ---- PHASE 5: M-08 usage billing ----------------------------------------
  describe("usage billing (M-08)", () => {
    const PERIOD = "2030-01";
    const RATES_KEY = "usage_overage_rates";

    const setRates = (rates: unknown) =>
      prisma.systemSetting.upsert({
        where: { key: RATES_KEY },
        update: { value: rates as never },
        create: { key: RATES_KEY, value: rates as never, updatedByEmail: "fin-test" },
      });

    const mkUsage = (organizationId: string, metric: string, quantity: number) =>
      prisma.usageRecord.create({ data: { organizationId, metric, quantity, period: PERIOD } });

    test("no rates configured → sweep is inert", async () => {
      const res = await usage.billUsagePeriod({ period: PERIOD });
      expect(res.ratesConfigured).toBe(false);
      expect(res.billedInvoices).toBe(0);
      expect(await prisma.invoice.count()).toBe(0);
    });

    test("valid configuration bills one invoice per org with summed metrics", async () => {
      const a = await mkOrg();
      const b = await mkOrg();
      await setRates({ api_calls: 10, storage: 200 });
      await mkUsage(a.id, "api_calls", 100); // 100 × 10 = 1000
      await mkUsage(a.id, "storage", 3); //     3 × 200 = 600
      await mkUsage(b.id, "api_calls", 50); //  50 × 10 = 500
      const res = await usage.billUsagePeriod({ period: PERIOD });
      expect(res.ratesConfigured).toBe(true);
      expect(res.billedInvoices).toBe(2);
      expect(res.billedTotalMinor).toBe(2_100);
      const invoices = await prisma.invoice.findMany({ where: { type: "usage" } });
      expect(invoices).toHaveLength(2);
      const aInv = invoices.find((i) => i.organizationId === a.id)!;
      expect(aInv.amount).toBe(1_600);
      expect(invoices.find((i) => i.organizationId === b.id)!.amount).toBe(500);
    });

    test("malformed configuration entries are dropped, valid ones still bill", async () => {
      const org = await mkOrg();
      await setRates({ api_calls: "abc", "bad-key": 5, storage: -4, emails: 0, sms: 25 });
      await mkUsage(org.id, "api_calls", 999);
      await mkUsage(org.id, "sms", 40); // only sms survives coercion
      const res = await usage.billUsagePeriod({ period: PERIOD });
      expect(res.billedInvoices).toBe(1);
      expect((await prisma.invoice.findFirstOrThrow({ where: { type: "usage" } })).amount).toBe(1_000);
    });

    test("negative-only configuration is inert; zero rate is valid-but-free", async () => {
      const org = await mkOrg();
      await mkUsage(org.id, "api_calls", 100);
      await setRates({ api_calls: -10 });
      expect((await usage.billUsagePeriod({ period: PERIOD })).ratesConfigured).toBe(false);
      // Zero = explicitly declared free tier: configured, but nothing billable.
      await setRates({ api_calls: 0 });
      expect((await usage.billUsagePeriod({ period: PERIOD })).ratesConfigured).toBe(true);
      expect(await prisma.invoice.count()).toBe(0);
    });

    test("same billing period processed twice never duplicates invoices", async () => {
      const org = await mkOrg();
      await setRates({ api_calls: 10 });
      await mkUsage(org.id, "api_calls", 100);
      await usage.billUsagePeriod({ period: PERIOD });
      const second = await usage.billUsagePeriod({ period: PERIOD });
      expect(second.billedInvoices).toBe(0);
      expect(second.skippedAlreadyBilled).toBe(1);
      expect(await prisma.invoice.count({ where: { type: "usage" } })).toBe(1);
    });

    test("concurrent sweeps stay idempotent against persisted state", async () => {
      const org = await mkOrg();
      await setRates({ api_calls: 10 });
      await mkUsage(org.id, "api_calls", 100);
      const results = await Promise.allSettled([usage.billUsagePeriod({ period: PERIOD }), usage.billUsagePeriod({ period: PERIOD })]);
      const billed = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.billedInvoices : 0), 0);
      expect(billed).toBe(1);
      expect(await prisma.invoice.count({ where: { type: "usage" } })).toBe(1);
    });

    test("mid-sweep failure leaves markers unset so the org is retried", async () => {
      // Simulated by rolling back a manual mirror of the sweep sequence.
      const org = await mkOrg();
      await setRates({ api_calls: 10 });
      await mkUsage(org.id, "api_calls", 100);
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.systemSetting.upsert({
            where: { key: "usage_billed_periods" },
            update: {},
            create: { key: "usage_billed_periods", value: {} as never, updatedByEmail: "t" },
          });
          await tx.invoice.create({ data: { organizationId: org.id, amount: 1_000, type: "usage", status: "issued" } });
          throw new Error("boom-after-marker-plan");
        }),
      ).rejects.toThrow("boom-after-marker-plan");
      // Nothing persisted → the real sweep still bills exactly once.
      const res = await usage.billUsagePeriod({ period: PERIOD });
      expect(res.billedInvoices).toBe(1);
      expect(await prisma.invoice.count({ where: { type: "usage" } })).toBe(1);
    });
  });

  // ---- PHASE 6: M-09 payouts/commissions ----------------------------------
  describe("payout balance (M-09)", () => {
    async function setupCommissions() {
      const aff = await mkAffiliate();
      await mkCommission(aff.id, 10_000, 4_000); // A: 60 left
      await mkCommission(aff.id, 20_000, 0); //    B: 200 left
      await mkCommission(aff.id, 30_000, 15_000); // C: 150 left
      return aff;
    }

    test("available balance sums remainders, not gross amounts", async () => {
      const aff = await setupCommissions();
      expect(await payouts.availablePayoutBalance({ affiliateId: aff.id })).toBe(41_000);
    });

    test("payout above available balance fails; exact balance succeeds", async () => {
      const aff = await setupCommissions();
      await expect(payouts.createPayout({ affiliateId: aff.id, amount: 41_001 })).rejects.toThrow(/exceed/i);
      const p = await payouts.createPayout({ affiliateId: aff.id, amount: 41_000 });
      expect(p.status).toBe("requested");
    });

    test("open payout locks its amount out of the balance", async () => {
      const aff = await setupCommissions();
      await payouts.createPayout({ affiliateId: aff.id, amount: 41_000 });
      expect(await payouts.availablePayoutBalance({ affiliateId: aff.id })).toBe(0);
      await expect(payouts.createPayout({ affiliateId: aff.id, amount: 1 })).rejects.toThrow(/exceed/i);
    });

    test("settling a payout consumes commissions FIFO down to zero", async () => {
      const aff = await setupCommissions();
      const p = await payouts.createPayout({ affiliateId: aff.id, amount: 41_000 });
      await payouts.updatePayoutStatus(p.id, "approved");
      await payouts.updatePayoutStatus(p.id, "processing");
      await payouts.updatePayoutStatus(p.id, "paid");
      expect(await payouts.availablePayoutBalance({ affiliateId: aff.id })).toBe(0);
      const rows = await prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "asc" } });
      expect(rows.map((r) => [r.paidAmount, r.status])).toEqual([
        [10_000, "paid"],
        [20_000, "paid"],
        [30_000, "paid"],
      ]);
    });

    test("concurrent payout attempts cannot consume the same balance twice", async () => {
      const aff = await setupCommissions();
      const results = await Promise.allSettled([
        payouts.createPayout({ affiliateId: aff.id, amount: 30_000 }),
        payouts.createPayout({ affiliateId: aff.id, amount: 30_000 }),
      ]);
      const requested = results.filter((r) => r.status === "fulfilled").length;
      const openTotal = await prisma.affiliatePayout.aggregate({ where: { affiliateId: aff.id }, _sum: { amount: true } });
      expect(openTotal._sum.amount ?? 0).toBeLessThanOrEqual(41_000);
      expect(requested).toBe(1);
    });
  });

  // ---- PHASE 7: M-01 dunning recovery --------------------------------------
  describe("dunning recovery (M-01)", () => {
    async function setupOwing() {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id, { status: "past_due" });
      const inv = await mkInvoice(org.id, 10_000, sub.id);
      const dc = await prisma.dunningCase.create({
        data: { organizationId: org.id, invoiceId: inv.id, subscriptionId: sub.id, attempt: 1, status: "active", nextRetryAt: new Date(Date.now() + 3_600_000) },
      });
      return { org, sub, inv, dc };
    }

    test("partial payment keeps dunning active and service suspended", async () => {
      const { org, sub, inv, dc } = await setupOwing();
      await pay(org.id, inv.id, 5_000);
      expect((await prisma.dunningCase.findUniqueOrThrow({ where: { id: dc.id } })).status).toBe("active");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("past_due");
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("partially_paid");
    });

    test("final payment settles invoice, recovers case, restores subscription", async () => {
      const { org, sub, inv, dc } = await setupOwing();
      await pay(org.id, inv.id, 5_000);
      await pay(org.id, inv.id, 5_000);
      expect((await prisma.dunningCase.findUniqueOrThrow({ where: { id: dc.id } })).status).toBe("recovered");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("active");
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });

    test("failed payment marks past_due, downgrades subscription, resumes existing case", async () => {
      const { org, sub, inv, dc } = await setupOwing();
      await pay(org.id, inv.id, 1_000, { status: "failed" });
      expect(await prisma.payment.count({ where: { invoiceId: inv.id, status: "failed" } })).toBe(1);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("past_due");
      expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("past_due");
      expect(await prisma.dunningCase.count({ where: { invoiceId: inv.id } })).toBe(1);
      expect((await prisma.dunningCase.findUniqueOrThrow({ where: { id: dc.id } })).status).toBe("active");
    });

    test("already-settled invoice tolerates a zero follow-up payment without side effects", async () => {
      const { org, inv } = await setupOwing();
      await pay(org.id, inv.id, 10_000); // recovers case too
      await pay(org.id, inv.id, 0);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
      expect(await prisma.dunningCase.count({ where: { invoiceId: inv.id } })).toBe(1);
    });

    test("repeated recovery is a no-op", async () => {
      const { inv } = await setupOwing();
      expect(await dunning.recoverCase(inv.id)).toBe(true);
      expect(await dunning.recoverCase(inv.id)).toBe(false);
    });
  });

  // ---- PHASE 8: M-03 void ---------------------------------------------------
  describe("void (M-03)", () => {
    test("unpaid invoice voids; payments absent, dunning closed, audit written", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id, { status: "past_due" });
      const inv = await mkInvoice(org.id, 10_000, sub.id);
      const dc = await prisma.dunningCase.create({ data: { organizationId: org.id, invoiceId: inv.id, subscriptionId: sub.id, attempt: 1, status: "active" } });
      await gateway.voidInvoice(inv.id, "admin@fin.test");
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      expect(after.status).toBe("void");
      expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(0);
      expect((await prisma.dunningCase.findUniqueOrThrow({ where: { id: dc.id } })).status).toBe("given_up");
      expect(await prisma.auditLog.count({ where: { action: "invoice.voided", targetId: inv.id } })).toBe(1);
    });

    test("partially paid invoice voids and keeps its payments visible", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await pay(org.id, inv.id, 4_000);
      await gateway.voidInvoice(inv.id, "admin@fin.test");
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("void");
      expect((await paySucceeded(inv.id))._sum.amount).toBe(4_000);
    });

    test("fully paid invoice cannot be voided", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await pay(org.id, inv.id, 10_000);
      await expect(gateway.voidInvoice(inv.id, "admin@fin.test")).rejects.toThrow(/refunded/i);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });

    test("double void reports the intended error and stays void once", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 10_000);
      await gateway.voidInvoice(inv.id, "admin@fin.test");
      await expect(gateway.voidInvoice(inv.id, "admin@fin.test")).rejects.toThrow(/already void/i);
      expect(await prisma.auditLog.count({ where: { action: "invoice.voided", targetId: inv.id } })).toBe(1);
    });

    test("void vs concurrent payment: exactly one valid terminal state wins", async () => {
      const org = await mkOrg();
      const plan = await mkPlan(10_000);
      const sub = await mkSub(org.id, plan.id, { status: "past_due" });
      const inv = await mkInvoice(org.id, 10_000, sub.id);
      await prisma.dunningCase.create({ data: { organizationId: org.id, invoiceId: inv.id, subscriptionId: sub.id, attempt: 1, status: "active" } });
      await Promise.allSettled([gateway.voidInvoice(inv.id, "admin@fin.test"), pay(org.id, inv.id, 10_000)]);
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      const succeeded = (await paySucceeded(inv.id))._sum.amount ?? 0;
      if (after.status === "void") {
        expect(succeeded).toBe(0);
      } else {
        expect(after.status).toBe("paid");
        expect(succeeded).toBe(10_000);
      }
      // Dunning always resolves consistently with the winner.
      const dc = await prisma.dunningCase.findFirstOrThrow({ where: { invoiceId: inv.id } });
      expect(["given_up", "recovered"]).toContain(dc.status);
    });
  });
});
