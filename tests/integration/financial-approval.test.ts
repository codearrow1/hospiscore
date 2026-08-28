/**
 * Four-eyes / dual-approval financial control — integration suite.
 *
 * Harness mirrors financial.test.ts: isolated temp SQLite DB, DATABASE_URL
 * overridden before any app import, `prisma db push --skip-generate`, dynamic
 * imports, FK-safe reset per test.
 *
 * Covers: request/approve/reject/cancel/expire; requester ≠ approver;
 * permission gates; duplicate-pending; snapshot integrity (stale target,
 * amount change, currency change); double-approval CAS (exactly one execute);
 * execution via canonical services; execution failure.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-fa-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "fa.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;
// Isolate the legacy marketing DataFile to a temp path so WRITE-AUDIT calls
// from this suite never touch the shared var/data.json (other test files race
// on it in parallel workers on Windows → EBUSY). Disable the home-dir mirror.
process.env.APP_DATA_FILE = path.join(tmpDir, "data-isolated.json");
process.env.APP_DATA_MIRROR = "";

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;

let prisma!: PrismaClient;
let fa!: typeof import("@/lib/saas/financialApproval");
let gateway!: typeof import("@/lib/saas/gateway");

const SUPERVISOR_A = { email: "approver-a@test.dev", role: "super_admin" as const };
const SUPERVISOR_B = { email: "approver-b@test.dev", role: "super_admin" as const };
const FINANCE = { email: "finance@test.dev", role: "finance_admin" as const };
const AFFILIATE_MGR = { email: "affiliate-mgr@test.dev", role: "affiliate_manager" as const };
const ANALYST = { email: "analyst@test.dev", role: "analyst" as const };

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  fa = await import("@/lib/saas/financialApproval");
  gateway = await import("@/lib/saas/gateway");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const RESET_TABLES = [
  "financialApproval",
  "auditLog",
  "payment",
  "invoice",
  "affiliatePayout",
  "affiliateCommission",
  "affiliate",
  "subscription",
  "systemSetting",
  "plan",
  "organization",
] as const;

beforeEach(async () => {
  for (const t of RESET_TABLES) await (prisma as never as Record<string, { deleteMany(): Promise<unknown> }>)[t].deleteMany();
});

let seq = 0;
const DAY = 86_400_000;

const mkOrg = () => prisma.organization.create({ data: { legalName: `FA Org ${++seq}` } });
const mkPlan = (price: number) =>
  prisma.plan.create({ data: { name: `FAPlan ${++seq}`, slug: `faplan-${seq}`, monthlyPrice: price, annualPrice: price * 10 } });
const mkSub = (orgId: string, planId: string) =>
  prisma.subscription.create({
    data: { organizationId: orgId, planId, status: "active", billingCycle: "monthly", mrr: 50_000, currentPeriodStart: new Date(Date.now() - 30 * DAY), currentPeriodEnd: new Date(Date.now() + 30 * DAY) },
  });
const mkInvoice = (orgId: string, amount: number, subId?: string) =>
  prisma.invoice.create({ data: { organizationId: orgId, subscriptionId: subId ?? null, amount, status: "issued", type: "subscription", dueAt: new Date(Date.now() + 7 * DAY) } });
const mkPayment = (orgId: string, amount: number, invId?: string) =>
  prisma.payment.create({ data: { organizationId: orgId, invoiceId: invId ?? null, gateway: "manual", amount, currency: "USD", status: "succeeded" } });
const mkAffiliate = () =>
  prisma.affiliate.create({ data: { name: `FAAff ${++seq}`, email: `fa-aff-${seq}@test.dev`, referralCode: `FAAF${seq}${Date.now()}`, status: "active" } });
const mkPayout = (affId: string, amount: number, status = "requested") =>
  prisma.affiliatePayout.create({ data: { affiliateId: affId, amount, currency: "USD", method: "bank", status } });
const mkCommission = (affId: string, amount: number) =>
  prisma.affiliateCommission.create({ data: { affiliateId: affId, amount, paidAmount: 0, status: "payable", model: "percent_first" } });

describe("Financial approval — invoice void", () => {
  test("request → approve executes canonical voidInvoice", async () => {
    const org = await mkOrg();
    const plan = await mkPlan(10_000);
    const sub = await mkSub(org.id, plan.id);
    const inv = await mkInvoice(org.id, 25_000, sub.id);

    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap).not.toBeNull();
    expect(ap!.status).toBe("pending");
    expect(ap!.amountMinor).toBe(25_000);
    expect(ap!.currency).toBe("USD");
    expect(ap!.requesterEmail).toBe(FINANCE.email);
    expect((ap!.snapshot as Record<string, unknown>).amountMinor).toBe(25_000);
    expect(ap!.organizationId).toBe(org.id);

    const decided = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(decided.ok).toBe(true);
    expect(decided.executed).toBe(true);

    const after = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(after!.status).toBe("executed");
    expect(after!.reviewerEmail).toBe(SUPERVISOR_A.email);
    expect(after!.executedAt).not.toBeNull();

    const invAfter = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(invAfter!.status).toBe("void");
  });

  test("already-issued invoice that becomes already-paid is blocked at approval (stale target)", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid", paidAt: new Date() } });

    const decided = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(decided.ok).toBe(false);
    expect(decided.status).toBe(409);
    expect(decided.error).toMatch(/paid invoices must be refunded|Target changed/i);

    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("pending");
  });

  test("duplicate pending request returns 409", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r1 = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r1.ok).toBe(true);
    const r2 = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(409);
  });

  test("requester without BILLING_MANAGE is forbidden (403)", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: ANALYST });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe("Financial approval — payment refund", () => {
  test("request by finance → approve refunds the payment", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(true);
    const payAfter = await prisma.payment.findUnique({ where: { id: pay.id } });
    expect(payAfter!.status).toBe("refunded");
  });

  test("self-approval is forbidden (403) even for a supervisor", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    // A supervisor can request; attempting to approve their own request must fail.
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: SUPERVISOR_A });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(403);
    expect(d.error).toMatch(/self-approval/i);
    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("pending");
  });

  test("a non-approver cannot approve (finance lacks FINANCIAL_APPROVE)", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.approveFinancialApproval(r.approvalId, FINANCE);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(403);
  });

  test("amount change between request and approval is blocked (stale instruction)", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await prisma.payment.update({ where: { id: pay.id }, data: { amount: 31_000 } });
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(409);
    expect(d.error).toMatch(/amount changed/i);
    const payAfter = await prisma.payment.findUnique({ where: { id: pay.id } });
    expect(payAfter!.status).toBe("succeeded");
  });

  test("currency change between request and approval is blocked", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await prisma.payment.update({ where: { id: pay.id }, data: { currency: "INR" } });
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(409);
    expect(d.error).toMatch(/currency changed/i);
  });

  test("already-refunded payment blocks approval", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await gateway.refundPayment(pay.id, "someone@test.dev"); // bypass
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(409);
    expect(d.error).toMatch(/already refunded|Only succeeded/i);
  });
});

describe("Financial approval — payout release", () => {
  test("request by affiliate manager → approve drops payout to paid", async () => {
    const aff = await mkAffiliate();
    await mkCommission(aff.id, 60_000); // payable commissions backing the payout
    const out = await mkPayout(aff.id, 50_000, "processing");
    const r = await fa.requestFinancialApproval({ actionType: "payout.release", targetId: out.id, requester: AFFILIATE_MGR });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(true);
    const after = await prisma.affiliatePayout.findUnique({ where: { id: out.id } });
    expect(after!.status).toBe("paid");
  });
});

describe("Financial approval — reject / cancel", () => {
  test("reject requires a reason", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.rejectFinancialApproval(r.approvalId, SUPERVISOR_A, "");
    expect(d.ok).toBe(false);
    expect(d.status).toBe(400);
  });

  test("reject with reason transitions to rejected and does not execute", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.rejectFinancialApproval(r.approvalId, SUPERVISOR_A, "Duplicate of an existing void");
    expect(d.ok).toBe(true);
    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("rejected");
    expect(ap!.decisionReason).toBe("Duplicate of an existing void");
    const invAfter = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(invAfter!.status).toBe("issued");
  });

  test("requester can cancel their own pending request", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.cancelFinancialApproval(r.approvalId, FINANCE);
    expect(d.ok).toBe(true);
    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("cancelled");
  });

  test("unrelated third party cannot cancel", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await fa.cancelFinancialApproval(r.approvalId, ANALYST);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(403);
  });

  test("expired approvals cannot be approved (expired 409)", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    const r = await fa.requestFinancialApproval({ actionType: "invoice.void", targetId: inv.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await prisma.financialApproval.update({ where: { id: r.approvalId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const d = await fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(409);
    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("expired");
  });
});

describe("Financial approval — concurrency + idempotency", () => {
  test("double concurrent approval executes exactly once (CAS single-claim)", async () => {
    const org = await mkOrg();
    const pay = await mkPayment(org.id, 30_000);
    const r = await fa.requestFinancialApproval({ actionType: "payment.refund", targetId: pay.id, requester: FINANCE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const [a, b] = await Promise.all([
      fa.approveFinancialApproval(r.approvalId, SUPERVISOR_A),
      fa.approveFinancialApproval(r.approvalId, SUPERVISOR_B),
    ]);

    const winners = [a, b].filter((x) => x.ok);
    const losers = [a, b].filter((x) => !x.ok);
    expect(winners.length).toBe(1);
    if (losers[0]) expect(losers[0].status).toBe(409);

    const ap = await prisma.financialApproval.findUnique({ where: { id: r.approvalId } });
    expect(ap!.status).toBe("executed");

    const payAfter = await prisma.payment.findUnique({ where: { id: pay.id } });
    expect(payAfter!.status).toBe("refunded");
  });
});

describe("Financial approval — policy resolution", () => {
  test("requiresApproval reflects enabled policy", async () => {
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    // Defaults: invoice.void always four-eyes; payment.refund threshold ₹10,000 (1_000_00 minor).
    expect(await fa.requiresApproval("invoice.void", inv.amount)).toBe(true);
    expect(await fa.requiresApproval("payment.refund", 5_000)).toBe(false);
    expect(await fa.requiresApproval("payment.refund", 1_000_00)).toBe(true);
  });

  test("disabling the policy allows direct action", async () => {
    await fa.saveFinancialControlsSettings({ enabled: false, expirationHours: 72, actions: {} }, "root@test.dev");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10_000);
    expect(await fa.requiresApproval("invoice.void", inv.amount)).toBe(false);
  });
});
