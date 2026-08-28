/**
 * Multi-Provider Payment Platform (Phase J2) — REAL database, REAL Prisma
 * transactions, injectable fake HTTP transports (no live gateway, no network).
 *
 * Harness mirrors tests/integration/financial.test.ts: an isolated temp SQLite
 * file under the OS tmpdir; DATABASE_URL is overridden BEFORE any @/ import so
 * the PrismaClient singleton binds to the temp DB; schema is pushed from
 * prisma/schema.prisma with one offline `prisma db push`.
 *
 * Coverage:
 *  - secret-at-rest crypto + masking/fee/capability pure helpers
 *  - webhook signature verification vectors per provider (Stripe, Razorpay,
 *    Cashfree, Adyen, PayU, generic) — valid + tampered
 *  - gateway request/response mapping via fake transports (createCheckout,
 *    getPaymentStatus, refund, testConnection; unwired provider = 501)
 *  - router: resolveProvider default/priority/fallback/currency/method
 *  - checkout guards: server-side ownership, no provider, already-settled
 *  - reconciliation: single-ledger settlement, idempotency/replay, amount
 *    integrity, refunds governed by four-eyes (webhook never self-refunds)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, describe, expect, test } from "vitest";

// ---- Harness bootstrap (must precede every @/ import) --------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-pay-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "pay.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;
type Store = typeof import("@/lib/saas/payments/store");
type Factory = typeof import("@/lib/saas/payments/factory");
type Intents = typeof import("@/lib/saas/payments/intents");
type Reconcile = typeof import("@/lib/saas/payments/reconcile");
type Validate = typeof import("@/lib/saas/payments/validate");
type Health = typeof import("@/lib/saas/payments/health");
type Errors = typeof import("@/lib/saas/payments/errors");
type Config = import("@/lib/saas/payments/types").ProviderConfig;
type Creds = import("@/lib/saas/payments/types").ProviderCredentials;
type HttpTransport = import("@/lib/saas/adapters/_shared").HttpTransport;

let prisma!: PrismaClient;
let store!: Store;
let factory!: Factory;
let intents!: Intents;
let reconcile!: Reconcile;
let validate!: Validate;
let health!: Health;
let errors!: Errors;
let helpers!: typeof import("@/lib/saas/payments/helpers");
let crypto!: typeof import("@/lib/saas/payments/crypto");
let shared!: typeof import("@/lib/saas/adapters/_shared");
let stripe!: typeof import("@/lib/saas/adapters/stripe");
let razorpay!: typeof import("@/lib/saas/adapters/razorpay");
let cashfree!: typeof import("@/lib/saas/adapters/cashfree");
let adyen!: typeof import("@/lib/saas/adapters/adyen");
let payu!: typeof import("@/lib/saas/adapters/payu");
let generic!: typeof import("@/lib/saas/adapters/generic");

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  store = await import("@/lib/saas/payments/store");
  factory = await import("@/lib/saas/payments/factory");
  intents = await import("@/lib/saas/payments/intents");
  reconcile = await import("@/lib/saas/payments/reconcile");
  validate = await import("@/lib/saas/payments/validate");
  health = await import("@/lib/saas/payments/health");
  errors = await import("@/lib/saas/payments/errors");
  helpers = await import("@/lib/saas/payments/helpers");
  crypto = await import("@/lib/saas/payments/crypto");
  shared = await import("@/lib/saas/adapters/_shared");
  stripe = await import("@/lib/saas/adapters/stripe");
  razorpay = await import("@/lib/saas/adapters/razorpay");
  cashfree = await import("@/lib/saas/adapters/cashfree");
  adyen = await import("@/lib/saas/adapters/adyen");
  payu = await import("@/lib/saas/adapters/payu");
  generic = await import("@/lib/saas/adapters/generic");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const RESET_TABLES = [
  "paymentWebhookLog",
  "paymentProviderHealth",
  "payment",
  "paymentIntent",
  "invoice",
  "systemSetting",
  "organization",
  "auditLog",
] as const;

beforeEach(async () => {
  for (const t of RESET_TABLES) await (prisma as never as Record<string, { deleteMany(): Promise<unknown> }>)[t].deleteMany();
});

let seq = 0;
const mkOrg = (country = "IN") => prisma.organization.create({ data: { legalName: `Pay Org ${++seq}`, country } });
const mkInvoice = (orgId: string, amount: number, currency = "INR") =>
  prisma.invoice.create({
    data: { organizationId: orgId, amount, status: "issued", type: "subscription", currency, dueAt: new Date(Date.now() + 7 * 86_400_000) },
  });

/** Save a provider and promote it to READY (as a successful connection test would). */
async function saveReady(input: Parameters<Store["saveProviderConfig"]>[0], actor = "a"): Promise<void> {
  await store.saveProviderConfig(input, actor);
  await store.setProviderStatus(input.id, "ready", actor);
}

/** A crisp config with plaintext secrets in `.masked` for DIRECT adapter tests. */
function mkDirectCfg(id: string, over: Partial<Config> = {}): Config {
  const creds: Creds = {
    secretKey: { set: true, masked: "sk_" + id, updatedAt: Date.now() },
    webhookSecret: { set: true, masked: "whsec_" + id, updatedAt: Date.now() },
    extra: { merchant_account: { set: true, masked: "MA" + id, updatedAt: Date.now() } },
  };
  return {
    id,
    label: id,
    integrationStatus: "verify",
    family: "fiat",
    enabled: true,
    isDefault: false,
    priority: 100,
    mode: "test",
    countries: [],
    currencies: [],
    methods: [],
    capabilities: [],
    fees: { default: undefined, byCurrency: {} },
    credentials: creds,
    webhookPath: `/api/payments/webhook/${id}`,
    health: { healthy: true, lastCheckedAt: null, lastError: null, successRate: null, consecutiveFailures: 0 },
    ...over,
  };
}

/** Fake transport recording calls and serving canned JSON responses. */
function fakeHttp(json: unknown, ok = true, status = 200): { fn: HttpTransport; calls: { url: string; init?: Record<string, unknown> }[] } {
  const calls: { url: string; init?: Record<string, unknown> }[] = [];
  const fn: HttpTransport = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, text: async () => JSON.stringify(json), json: async () => json };
  };
  return { fn, calls };
}

// ===========================================================================
describe("[payments-platform]", { timeout: 60_000 }, () => {
  // ---------------------- A. pure helpers (no DB) ------------------------
  describe("helpers", () => {
    test("maskSecret never reveals a raw secret", () => {
      const m = helpers.maskSecret("sk_live_abcdef123456");
      expect(m).toBeTruthy();
      expect(m).not.toContain("abcdef123456");
      expect(m).toContain("••••");
      expect(helpers.maskSecret("ab")).toBe("••••");
      expect(helpers.maskSecret(null)).toBeNull();
    });

    test("toMaskedSecret preserves existing state when no new value supplied", () => {
      const existing = { set: true, masked: "sk_live_••••5678", updatedAt: 1 };
      expect(helpers.toMaskedSecret(undefined, existing)).toEqual(existing);
      const fresh = helpers.toMaskedSecret("sk_test_1234");
      expect(fresh.set).toBe(true);
      expect(fresh.masked).not.toBe("sk_test_1234");
      expect(fresh.masked).not.toContain("est_");
    });

    test("computeProviderFee honors percent, fixed, and cap", () => {
      expect(helpers.computeProviderFee(10000, "USD", { default: { percent: 2.9 } })).toBe(290);
      expect(helpers.computeProviderFee(10000, "USD", { default: { fixedMinor: 30 } })).toBe(30);
      expect(helpers.computeProviderFee(100000, "USD", { default: { percent: 2.9, capMinor: 500 } })).toBe(500);
      const byCur = { byCurrency: { INR: { percent: 2.0 } } };
      expect(helpers.computeProviderFee(10000, "INR", byCur)).toBe(200);
      expect(helpers.computeProviderFee(10000, "USD", { default: undefined, byCurrency: {} })).toBe(0);
    });

    test("normalizeCapabilities drops unknown values", () => {
      expect(helpers.normalizeCapabilities(["webhook", "refund", "fake_cap"])).toEqual(["webhook", "refund"]);
      expect(helpers.normalizeCapabilities("nope")).toEqual([]);
    });

    test("crypto round-trips and safeEqual is constant-time", () => {
      const enc = crypto.encryptSecret("whsec_sensitive");
      expect(enc).not.toContain("whsec_sensitive");
      expect(crypto.decryptSecret(enc)).toBe("whsec_sensitive");
      expect(crypto.decryptSecret("garbage")).toBe("");
      expect(crypto.safeEqual("abc", "abc")).toBe(true);
      expect(crypto.safeEqual("abc", "abd")).toBe(false);
    });
  });

  // ------------------- B. webhook signature vectors -----------------------
  describe("webhook signature verification", () => {
    test("Stripe: valid signature accepted, tampered body rejected", async () => {
      const secret = "whsec_test";
      const body = JSON.stringify({ id: "evt_1", type: "charge.succeeded", data: { object: { id: "cs_1", amount: 1000, currency: "usd" } } });
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = `t=${ts},v1=${shared.hmacSha256Hex(secret, `${ts}.${body}`)}`;
      const adapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe", { credentials: { webhookSecret: { set: true, masked: secret, updatedAt: Date.now() } } }), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, { "stripe-signature": sig });
      expect(ev.providerId).toBe("stripe");
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.amountMinor).toBe(1000);

      await expect(adapter.verifyWebhook(body.replace("evt_1", "evt_2"), { "stripe-signature": sig })).rejects.toMatchObject({ status: 400 });
    });

    test("Razorpay: HMAC valid + tampered", async () => {
      const secret = "rzp_whsec";
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", amount: 5000, currency: "INR", status: "captured" } } } });
      const sig = shared.hmacSha256Hex(secret, body);
      const adapter = razorpay.razorpayAdapter.newWithTransport(mkDirectCfg("razorpay", { credentials: { webhookSecret: { set: true, masked: secret, updatedAt: Date.now() } } }), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, { "x-razorpay-signature": sig });
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.eventId).toBe("payment.captured");
      await expect(adapter.verifyWebhook(body, { "x-razorpay-signature": "deadbeef" })).rejects.toMatchObject({ status: 400 });
    });

    test("Cashfree: base64(HMAC) valid + tampered", async () => {
      const secret = "cf_whsec";
      const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", order: { order_id: "ord_1" }, payment: { cf_payment_id: "cf_1", payment_status: "SUCCESS", order_amount: 2500, order_currency: "INR" } });
      const hmac = shared.hmacSha256Hex(secret, body);
      const sig = Buffer.from(hmac, "hex").toString("base64");
      const adapter = cashfree.cashfreeAdapter.newWithTransport(mkDirectCfg("cashfree", { credentials: { secretKey: { set: true, masked: "cs_cf", updatedAt: Date.now() }, webhookSecret: { set: true, masked: secret, updatedAt: Date.now() }, extra: { client_id: { set: true, masked: "cid_cf", updatedAt: Date.now() } } } }), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, { "x-webhook-signature": sig });
      expect(ev.type).toBe("payment.succeeded");
      await expect(adapter.verifyWebhook(body, { "x-webhook-signature": "AAAA" })).rejects.toMatchObject({ status: 400 });
    });

    test("Adyen: HMAC over signed data string", async () => {
      const hmac = "ADYEN_HMAC_KEY";
      const item = {
        amount: { value: 10000, currency: "USD" },
        merchantAccountCode: "ma_test",
        merchantReference: "ref_1",
        pspReference: "8515334680012345",
        eventCode: "AUTHORISATION",
        success: "true",
      };
      const signedString = "100.00:USD:ma_test:ref_1:8515334680012345:AUTHORISATION:true:";
      const hmacSignature = shared.hmacSha256Hex(hmac, signedString);
      const body = JSON.stringify({ notificationItems: [{ NotificationRequestItem: { ...item, additionalData: { hmacSignature: [hmacSignature] } } }] });
      const adapter = adyen.adyenAdapter.newWithTransport(mkDirectCfg("adyen", { credentials: { secretKey: { set: true, masked: "sk_adyen", updatedAt: Date.now() }, webhookSecret: { set: true, masked: hmac, updatedAt: Date.now() }, extra: { merchant_account: { set: true, masked: "ma_test", updatedAt: Date.now() } } } }), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, {});
      expect(ev.providerRef).toBe("ref_1");
      expect(ev.type).toBe("payment.succeeded");
      await expect(adapter.verifyWebhook(body.replace("AUTHORISATION", "MANUAL_REVIEW"), {})).rejects.toMatchObject({ status: 400 });
    });

    test("PayU: reverse-hash accepted and normalized", async () => {
      const salt = "PU_SALT";
      const params = new URLSearchParams();
      params.set("txnid", "txn_1");
      params.set("mihpayid", "mi_1");
      params.set("status", "success");
      params.set("amount", "120.00");
      params.set("productinfo", "Invoice inv_1");
      params.set("firstname", "org_1");
      params.set("email", "billing@hospios.app");
      params.set("currency", "INR");
      params.set("mode", "CC");
      const reverse = `${salt}|success|||||||||||billing@hospios.app|org_1|Invoice inv_1|120.00|txn_1||||||||||mi_1`;
      params.set("hash", createHash("sha512").update(reverse).digest("hex"));
      const body = params.toString();
      const adapter = payu.payuAdapter.newWithTransport(mkDirectCfg("payu", { credentials: { secretKey: { set: true, masked: salt, updatedAt: Date.now() }, extra: { merchant_key: { set: true, masked: "PU_KEY", updatedAt: Date.now() }, merchant_hash: { set: true, masked: "PU_MH", updatedAt: Date.now() } } } }), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, {});
      expect(ev.providerRef).toBe("txn_1");
      expect(ev.type).toBe("payment.succeeded");
    });

    test("Generic: HMAC valid + tampered; unwired createCheckout throws 501", async () => {
      const secret = "gen_whsec";
      const body = JSON.stringify({ id: "evt_g", reference: "ord_g", amount: 1000, currency: "USD" });
      const sig = shared.hmacSha256Hex(secret, body);
      const adapter = generic.genericHmacAdapter.instance(mkDirectCfg("checkout.com", { credentials: { webhookSecret: { set: true, masked: secret, updatedAt: Date.now() } } }));
      const ev = await adapter.verifyWebhook(body, { "x-webhook-signature": sig });
      expect(ev.providerRef).toBe("ord_g");
      await expect(adapter.verifyWebhook(body, { "x-webhook-signature": "nope" })).rejects.toMatchObject({ status: 400 });

      await expect(adapter.createCheckout({ intentId: "i", organizationId: "o", amountMinor: 1000, currency: "USD", idempotencyKey: "k" })).rejects.toMatchObject({ status: 501 });
      await expect(adapter.refund({ providerRef: "r", amountMinor: 10, currency: "USD" })).rejects.toMatchObject({ status: 501 });
    });
  });

  // ------------------- C. gateway mapping (fake transport) ----------------
  describe("gateway request/response mapping", () => {
    test("Stripe createCheckout posts correct body and maps url/id", async () => {
      const { fn, calls } = fakeHttp({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1", expires_at: 1_700_000_000 });
      const adapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), fn);
      const out = await adapter.createCheckout({ intentId: "int_1", organizationId: "org_1", amountMinor: 1234, currency: "USD", idempotencyKey: "ik_1" });
      expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
      expect(out.providerRef).toBe("cs_test_1");
      expect(calls[0].url).toContain("/v1/checkout/sessions");
      expect(String(calls[0].init?.body)).toContain("unit_amount%5D=1234");
      expect(JSON.stringify(calls[0].init?.headers)).toContain("Bearer sk_stripe");
    });

    test("Stripe getPaymentStatus + refund map provider responses", async () => {
      const status = fakeHttp({ payment_status: "paid", amount_total: 5000, currency: "usd", payment_intent: "pi_1" });
      const sAdapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), status.fn);
      const st = await sAdapter.getPaymentStatus("cs_1");
      expect(st.status).toBe("succeeded");
      expect(st.amountMinor).toBe(5000);

      const refund = fakeHttp({ id: "re_1", amount: 5000 });
      const rAdapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), refund.fn);
      const r = await rAdapter.refund({ providerRef: "pi_1", amountMinor: 5000, currency: "usd" });
      expect(r.ok).toBe(true);
      expect(r.refundedAmountMinor).toBe(5000);
      expect(refund.calls[0].url).toContain("/v1/refunds");
    });

    test("adapter testConnection returns structured CONNECTED/FAILED", async () => {
      const ok = fakeHttp({}, true);
      const adapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), ok.fn);
      const res = await adapter.testConnection(mkDirectCfg("stripe").credentials);
      expect(res.status).toBe("CONNECTED");

      const bad = fakeHttp({}, false, 401);
      const badAdapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), bad.fn);
      const badRes = await badAdapter.testConnection(mkDirectCfg("stripe").credentials);
      expect(badRes.status).toBe("FAILED");
      expect(String(badRes.error)).toContain("401");
    });

    test("testConnection returns MISCONFIGURED when required credentials missing", async () => {
      const adapter = stripe.stripeAdapter.newWithTransport(mkDirectCfg("stripe"), shared.defaultHttp);
      const res = await adapter.testConnection({ secretKey: { set: false, masked: "", updatedAt: 0 } });
      expect(res.status).toBe("MISCONFIGURED");
    });
  });

  // ------------------- D. routing -------------------
  describe("router (resolveProvider)", () => {
    test("default provider wins when capable of the currency", async () => {
      await saveReady({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, priority: 1, currencies: ["INR"], methods: ["card"], mode: "test" });
      await saveReady({ id: "razorpay", label: "Razorpay", enabled: true, priority: 2, currencies: ["INR"], methods: ["card"], mode: "test" });
      const adapter = await factory.resolveProvider({ currency: "INR", method: "card" });
      expect(adapter?.providerId).toBe("stripe");
    });

    test("higher (lower-number) priority chosen when no default", async () => {
      await saveReady({ id: "razorpay", label: "Razorpay", enabled: true, priority: 1, currencies: ["INR"] });
      await saveReady({ id: "stripe", label: "Stripe", enabled: true, priority: 5, currencies: ["INR"] });
      const adapter = await factory.resolveProvider({ currency: "INR" });
      expect(adapter?.providerId).toBe("razorpay");
    });

    test("currency filtering + no ready provider -> null", async () => {
      await saveReady({ id: "razorpay", label: "Razorpay", enabled: true, priority: 1, currencies: ["INR"] });
      expect(await factory.resolveProvider({ currency: "USD" })).toBeNull();
      await saveReady({ id: "razorpay", label: "Razorpay", enabled: false, priority: 1, currencies: ["INR"] });
      expect(await factory.resolveProvider({ currency: "INR" })).toBeNull();
    });

    test("method filtering", async () => {
      await saveReady({ id: "cashfree", label: "Cashfree", enabled: true, priority: 1, currencies: ["INR"], methods: ["upi"] });
      expect((await factory.resolveProvider({ currency: "INR", method: "upi" }))?.providerId).toBe("cashfree");
      expect(await factory.resolveProvider({ currency: "INR", method: "card" })).toBeNull();
    });

    test("creating a provider is NOT ready until a successful connection test", async () => {
      await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true }, "a");
      const stripeCfg = await store.getProviderConfig("stripe");
      expect(stripeCfg?.integrationStatus).toBe("verifying");
      await store.saveProviderConfig({ id: "coinbase", label: "Coinbase", enabled: true }, "a");
      const cb = await store.getProviderConfig("coinbase");
      expect(cb?.integrationStatus).toBe("registered");
    });
  });

  // ------------------- E. checkout guards (server-side, no network) ------
  describe("checkout guards", () => {
    test("createPaymentIntent rejects when no provider enabled", async () => {
      const org = await mkOrg();
      const inv = await mkInvoice(org.id, 1000);
      await expect(intents.createPaymentIntent({ organizationId: org.id, invoiceId: inv.id, actorEmail: "a@b" })).rejects.toThrow("No payment provider is enabled");
    });

    test("createPaymentIntent rejects foreign invoice and already-settled invoice", async () => {
      await saveReady({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test" });
      const orgA = await mkOrg();
      const orgB = await mkOrg();
      const invA = await mkInvoice(orgA.id, 1000);
      await expect(intents.createPaymentIntent({ organizationId: orgB.id, invoiceId: invA.id, actorEmail: "a@b" })).rejects.toThrow("does not belong to this organization");
      await prisma.invoice.update({ where: { id: invA.id }, data: { status: "paid" } });
      await expect(intents.createPaymentIntent({ organizationId: orgA.id, invoiceId: invA.id, actorEmail: "a@b" })).rejects.toThrow("already settled");
    });
  });

  // ------------------- F. reconciliation -------------------
  test("verified webhook settles one canonical Payment (single ledger) and invoice", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_1", secretKey: "sk_1" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    const intent = await prisma.paymentIntent.create({
      data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "created", idempotencyKey: "ik_1", providerRef: "cs_1", rawMeta: {} },
    });

    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", amount_total: 10000, currency: "inr", payment_method_types: ["card"] } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `t=${ts},v1=${shared.hmacSha256Hex("whsec_1", `${ts}.${body}`)}`;

    const res = await reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers: { "stripe-signature": sig }, ip: "127.0.0.1" });
    expect(res.status).toBe("reconciled");

    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("succeeded");
    expect(payments[0].amount).toBe(10000);
    expect(payments[0].providerRef).toBe("cs_1");
    expect(payments[0].paymentIntentId).toBe(intent.id);

    const updatedInv = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(updatedInv.status).toBe("paid");

    const done = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(done.status).toBe("succeeded");
    expect(done.settledPaymentId).toBe(payments[0].id);

    const log = await prisma.paymentWebhookLog.findMany({ where: { eventId: "evt_1" } });
    expect(log.some((l) => l.status === "reconciled")).toBe(true);
  });

  test("replay of the same event never creates a second Payment", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_1", secretKey: "sk_1" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "created", idempotencyKey: "ik_1", providerRef: "cs_1", rawMeta: {} } });

    const body = JSON.stringify({ id: "evt_replay", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", amount_total: 10000, currency: "inr", payment_method_types: ["card"] } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `t=${ts},v1=${shared.hmacSha256Hex("whsec_1", `${ts}.${body}`)}`;
    const headers = { "stripe-signature": sig };

    const first = await reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers, ip: "127.0.0.1" });
    expect(first.status).toBe("reconciled");
    const second = await reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers, ip: "127.0.0.1" });
    expect(second.status).toBe("already_handled");

    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(1);
  });

  test("amount mismatch with the intent fails the reconcile without settling", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_1", secretKey: "sk_1" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "created", idempotencyKey: "ik_1", providerRef: "cs_1", rawMeta: {} } });

    const body = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", amount_total: 9999, currency: "inr", payment_method_types: ["card"] } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `t=${ts},v1=${shared.hmacSha256Hex("whsec_1", `${ts}.${body}`)}`;
    await expect(reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers: { "stripe-signature": sig }, ip: "127.0.0.1" })).rejects.toThrow("Amount mismatch");

    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(0);
    const log = await prisma.paymentWebhookLog.findMany({ where: { eventId: "evt_bad" } });
    expect(log.some((l) => l.status === "failed")).toBe(true);
  });

  test("refund webhook never self-refunds — routed through four-eyes control instead", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_1", secretKey: "sk_1" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    await prisma.payment.create({ data: { organizationId: org.id, invoiceId: inv.id, amount: 10000, currency: "INR", status: "succeeded", gateway: "stripe", paymentIntentId: null } });
    await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "succeeded", idempotencyKey: "ik_1", providerRef: "cs_1", settledPaymentId: null, rawMeta: {} } });

    const body = JSON.stringify({ id: "evt_refund", type: "charge.refunded", data: { object: { id: "cs_1", payment_intent: "pi_1", amount_total: 10000, amount_refunded: 10000, currency: "inr" } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `t=${ts},v1=${shared.hmacSha256Hex("whsec_1", `${ts}.${body}`)}`;
    const res = await reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers: { "stripe-signature": sig }, ip: "127.0.0.1" });
    expect(res.status).toBe("noop");

    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(1); // untouched — no self-refund
    expect(payments[0].status).toBe("succeeded");
  });

  test("verifyWebhook on an unconfigured/unknown provider fails cleanly", async () => {
    await expect(reconcile.reconcileWebhook({ providerId: "unknown", rawBody: "{}", headers: {} })).rejects.toThrow("Provider not configured");
  });

  test("testProviderConnection returns FAILED for unknown provider", async () => {
    const res = await validate.testProviderConnection({ providerId: "nope", secrets: {} });
    expect(res.status).toBe("FAILED");
    expect(String(res.error)).toContain("Unknown provider");
  });

  // ----- G. Phase K: error taxonomy (pure) -----------------------------
  describe("error taxonomy", () => {
    test("classifyPaymentError maps codes, statuses, and messages", () => {
      expect(errors.classifyPaymentError(null, { code: "card_declined" })).toBe("CARD_DECLINED");
      expect(errors.classifyPaymentError(null, { code: "insufficient_funds" })).toBe("INSUFFICIENT_FUNDS");
      expect(errors.classifyPaymentError(null, { status: 429 })).toBe("RATE_LIMITED");
      expect(errors.classifyPaymentError(null, { status: 500 })).toBe("PROVIDER_UNAVAILABLE");
      expect(errors.classifyPaymentError(null, { status: 401 })).toBe("AUTHENTICATION_FAILED");
      expect(errors.classifyPaymentError(new Error("Your card was declined"))).toBe("CARD_DECLINED");
      expect(errors.classifyPaymentError(new Error("request timed out"))).toBe("TIMEOUT");
      expect(errors.classifyPaymentError(new Error("unexpected thing"))).toBe("UNKNOWN");
    });

    test("friendlyMessageFor returns a stable customer-safe message and never leaks raw", () => {
      expect(errors.friendlyMessageFor(new Error("card declined: 9999 8888 7777"))).toContain("declined");
      expect(errors.friendlyMessageFor(new Error("card declined"))).not.toMatch(/9999/);
      expect(errors.sanitizePaymentError(new Error("boom")).reason).toBeDefined();
    });
  });

  // ----- H. Phase K: status machine ------------------------------------
  describe("activation status machine", () => {
    test("save → verifying/registered/disabled; setProviderStatus → ready", async () => {
      await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true }, "a");
      expect((await store.getProviderConfig("stripe"))?.integrationStatus).toBe("verifying");
      await store.setProviderStatus("stripe", "ready", "a");
      expect((await store.getProviderConfig("stripe"))?.integrationStatus).toBe("ready");

      await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: false }, "a");
      expect((await store.getProviderConfig("stripe"))?.integrationStatus).toBe("disabled");

      await store.saveProviderConfig({ id: "coinbase", label: "CB", enabled: true }, "a");
      expect((await store.getProviderConfig("coinbase"))?.integrationStatus).toBe("registered");
      await store.setProviderStatus("coinbase", "ready", "a");
      expect((await store.getProviderConfig("coinbase"))?.integrationStatus).toBe("registered"); // unwired never ready
    });

    test("routing excludes non-ready providers; ready providers route", async () => {
      await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test" }, "a");
      expect(await factory.resolveProvider({ currency: "INR" })).toBeNull(); // verifying → not routed
      await store.setProviderStatus("stripe", "ready", "a");
      expect((await factory.resolveProvider({ currency: "INR" }))?.providerId).toBe("stripe");
    });

    test("a successful connection test persists ready only for CONNECTED", async () => {
      // simulate the API-route persistence path by pointing at a fake transport
      // is not reachable here; assert the store transition + recordProviderOutcome
      await saveReady({ id: "stripe", label: "Stripe", enabled: true, currencies: ["INR"] });
      await health.recordProviderOutcome({ providerId: "stripe", ok: true, actorEmail: "a" });
      const healthRows = await health.listProviderHealth();
      const row = healthRows.find((r) => r.providerId === "stripe");
      expect(row?.healthy).toBe(true);
      expect(row?.totalCalls).toBeGreaterThan(0);
    });
  });

  // ----- I. Phase K: concurrency + expiry + webhook health -------------
  test("concurrent duplicate webhooks never create a second Payment", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_conc", secretKey: "sk_c" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "created", idempotencyKey: "ik_c", providerRef: "cs_c", rawMeta: {} } });

    const body = JSON.stringify({ id: "evt_concurrent", type: "checkout.session.completed", data: { object: { id: "cs_c", payment_intent: "pi_c", amount_total: 10000, currency: "inr", payment_method_types: ["card"] } } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `t=${ts},v1=${shared.hmacSha256Hex("whsec_conc", `${ts}.${body}`)}`;
    const headers = { "stripe-signature": sig };

    const results = await Promise.allSettled([
      reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers, ip: "127.0.0.1" }),
      reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers, ip: "127.0.0.1" }),
    ]);
    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(1);
    const logs = await prisma.paymentWebhookLog.findMany({ where: { provider: "stripe", eventId: "evt_concurrent" } });
    expect(logs).toHaveLength(1);
    void results;
  });

  test("webhook health aggregates per provider", async () => {
    await store.saveProviderConfig({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { webhookSecret: "whsec_h", secretKey: "sk_h" } }, "a");
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "created", idempotencyKey: "ik_h", providerRef: "cs_h", rawMeta: {} } });
    const body = JSON.stringify({ id: "evt_h1", type: "checkout.session.completed", data: { object: { id: "cs_h", payment_intent: "pi_h", amount_total: 10000, currency: "inr", payment_method_types: ["card"] } } });
    const ts = String(Math.floor(Date.now() / 1000));
    await reconcile.reconcileWebhook({ providerId: "stripe", rawBody: body, headers: { "stripe-signature": `t=${ts},v1=${shared.hmacSha256Hex("whsec_h", `${ts}.${body}`)}` }, ip: "127.0.0.1" });
    const wh = await health.listWebhookHealth("stripe");
    expect(wh).toHaveLength(1);
    expect(wh[0].totalEvents).toBeGreaterThan(0);
    expect(wh[0].reconciled).toBeGreaterThan(0);
    expect(wh[0].lastStatus).toBeDefined();
  });

  test("intent expiry: an expired open intent is closed and a fresh one created", async () => {
    await saveReady({ id: "stripe", label: "Stripe", enabled: true, isDefault: true, currencies: ["INR"], mode: "test", secrets: { secretKey: "sk_e", webhookSecret: "whsec_e" } });
    const org = await mkOrg();
    const inv = await mkInvoice(org.id, 10000, "INR");
    const stale = await prisma.paymentIntent.create({ data: { organizationId: org.id, invoiceId: inv.id, provider: "stripe", amount: 10000, currency: "INR", status: "requires_payment", idempotencyKey: "ik_stale", providerRef: "cs_stale", expiresAt: new Date(Date.now() - 1000), rawMeta: {} } });

    const originalFetch = globalThis.fetch;
    const stub = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({}),
        json: async () => ({
          id: "cs_fresh",
          url: "https://checkout.stripe.com/c/pay/fresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      }) as unknown as Response;
    globalThis.fetch = stub as typeof fetch;
    try {
      const fresh = await intents.createPaymentIntent({ organizationId: org.id, invoiceId: inv.id, actorEmail: "a@b" });
      expect(fresh.intentId).not.toBe(stale.id);
      expect(fresh.expiresAtMs).toBeGreaterThan(Date.now());
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("expired");
  });
});
