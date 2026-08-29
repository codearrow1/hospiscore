/**
 * FINAL PRE-LAUNCH CLOSURE — Phase 5: Caller idempotency integration tests.
 *
 * Verifies B-3 durable idempotency keys on Invoice + Payment:
 *   - same key            -> same logical result (no duplicate financial records)
 *   - different key       -> new operation where valid
 *   - retry after timeout -> dedup
 *   - concurrent request  -> dedup / no duplicate
 *   - duplicate provider reference -> rejected by @@unique(providerPaymentId)
 *   - no overpay / no incorrect balances
 *
 * Harness mirrors tests/integration/financial.test.ts: isolated temp SQLite,
 * schema via `prisma db push --skip-generate`, dynamic app imports, empty DB per
 * test, real parallel concurrency.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";

// ---- Harness bootstrap (must precede every @/ import) --------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-idem-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "idem.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;
type Gateway = typeof import("@/lib/saas/gateway");

let prisma!: PrismaClient;
let gateway!: Gateway;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  gateway = await import("@/lib/saas/gateway");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const RESET = ["payment", "invoice", "subscription", "plan", "organization", "auditLog"] as const;

beforeEach(async () => {
  for (const t of RESET) await (prisma as never as Record<string, { deleteMany(): Promise<unknown> }>)[t].deleteMany();
});

let seq = 0;
const mkOrg = () => prisma.organization.create({ data: { legalName: `Idem Org ${++seq}` } });

const paySucceeded = (invoiceId: string) =>
  prisma.payment.aggregate({ where: { invoiceId, status: "succeeded" }, _sum: { amount: true } });

const pay = (
  organizationId: string,
  invoiceId: string,
  amount: number,
  idempotencyKey?: string,
) => gateway.recordPayment({ organizationId, invoiceId, amount, actorEmail: "idem-test", idempotencyKey });

// ===========================================================================
describe("[idempotency-integration]", { timeout: 60_000 }, () => {
  describe("createInvoice caller idempotency (B-3)", () => {
    test("same key -> same invoice, no duplicate on retry-after-timeout", async () => {
      const org = await mkOrg();
      const key = `inv-retry-${++seq}`;
      const a = await gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key });
      // Simulate the first response being lost and the client retrying with the SAME key.
      const b = await gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key });
      expect(b.id).toBe(a.id);
      expect(await prisma.invoice.count()).toBe(1);
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.amount).toBe(10_000);
      expect(row.idempotencyKey).toBe(key);
    });

    test("same key with identical re-request never changes the original amount", async () => {
      const org = await mkOrg();
      const key = `inv-immutable-${++seq}`;
      const a = await gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key });
      const b = await gateway.createInvoice({ organizationId: org.id, amount: 99_000, actorEmail: "idem-test", idempotencyKey: key });
      expect(b.id).toBe(a.id);
      expect(await prisma.invoice.count()).toBe(1);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.id } })).amount).toBe(10_000);
    });

    test("different key -> distinct invoices", async () => {
      const org = await mkOrg();
      const a = await gateway.createInvoice({ organizationId: org.id, amount: 1_000, actorEmail: "idem-test", idempotencyKey: `inv-a-${++seq}` });
      const b = await gateway.createInvoice({ organizationId: org.id, amount: 2_000, actorEmail: "idem-test", idempotencyKey: `inv-b-${seq}` });
      expect(a.id).not.toBe(b.id);
      expect(await prisma.invoice.count()).toBe(2);
    });

    test("concurrent same-key requests produce exactly one invoice", async () => {
      const org = await mkOrg();
      const key = `inv-conc-${++seq}`;
      const results = await Promise.allSettled([
        gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key }),
        gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key }),
        gateway.createInvoice({ organizationId: org.id, amount: 10_000, actorEmail: "idem-test", idempotencyKey: key }),
      ]);
      expect(await prisma.invoice.count()).toBe(1);
      const fulfilledIds = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof gateway.createInvoice>>> => r.status === "fulfilled")
        .map((r) => r.value.id);
      expect(new Set(fulfilledIds).size).toBeLessThanOrEqual(1);
    });

    test("no key supplied still creates independent invoices (back-compat)", async () => {
      const org = await mkOrg();
      await gateway.createInvoice({ organizationId: org.id, amount: 1_000, actorEmail: "idem-test" });
      await gateway.createInvoice({ organizationId: org.id, amount: 1_000, actorEmail: "idem-test" });
      expect(await prisma.invoice.count()).toBe(2);
    });
  });

  describe("recordPayment caller idempotency (B-3)", () => {
    test("same key -> same payment, invoice settled exactly once, no overpay", async () => {
      const org = await mkOrg();
      const inv = await prisma.invoice.create({ data: { organizationId: org.id, amount: 10_000, status: "issued", type: "subscription" } });
      const key = `pay-retry-${++seq}`;
      const a = await pay(org.id, inv.id, 10_000, key);
      const b = await pay(org.id, inv.id, 10_000, key);
      expect(b.id).toBe(a.id);
      expect(await prisma.payment.count()).toBe(1);
      expect((await paySucceeded(inv.id))._sum.amount ?? 0).toBe(10_000);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });

    test("concurrent same-key requests record exactly one payment", async () => {
      const org = await mkOrg();
      const inv = await prisma.invoice.create({ data: { organizationId: org.id, amount: 10_000, status: "issued", type: "subscription" } });
      const key = `pay-conc-${++seq}`;
      await Promise.allSettled([pay(org.id, inv.id, 10_000, key), pay(org.id, inv.id, 10_000, key), pay(org.id, inv.id, 10_000, key)]);
      expect(await prisma.payment.count()).toBe(1);
      expect((await paySucceeded(inv.id))._sum.amount ?? 0).toBe(10_000);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("paid");
    });

    test("different keys remain distinct payments and never overpay", async () => {
      const org = await mkOrg();
      const inv = await prisma.invoice.create({ data: { organizationId: org.id, amount: 10_000, status: "issued", type: "subscription" } });
      await pay(org.id, inv.id, 7_000, `pay-x-${++seq}`);
      await expect(pay(org.id, inv.id, 7_000, `pay-y-${seq}`)).rejects.toThrow(/exceeds|raced/i);
      const total = (await paySucceeded(inv.id))._sum.amount ?? 0;
      expect(total).toBe(7_000);
      expect(total).toBeLessThanOrEqual(10_000);
    });

    test("duplicate provider reference is impossible (providerPaymentId @@unique)", async () => {
      const org = await mkOrg();
      const inv = await prisma.invoice.create({ data: { organizationId: org.id, amount: 10_000, status: "issued", type: "subscription" } });
      await prisma.payment.create({
        data: { organizationId: org.id, invoiceId: inv.id, amount: 10_000, status: "succeeded", gateway: "stripe", providerPaymentId: "ch_dup" },
      });
      await expect(
        prisma.payment.create({
          data: { organizationId: org.id, invoiceId: inv.id, amount: 10_000, status: "succeeded", gateway: "stripe", providerPaymentId: "ch_dup" },
        }),
      ).rejects.toThrow();
      expect(await prisma.payment.count()).toBe(1);
    });
  });
});
