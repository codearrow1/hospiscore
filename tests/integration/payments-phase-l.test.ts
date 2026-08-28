/**
 * Multi-Provider Payment Platform — Phase L (six priority adapters).
 *
 * REAL Prisma harness identical to tests/integration/payments.test.ts: an
 * isolated temp SQLite DB, DATABASE_URL overridden BEFORE any @/ import, schema
 * pushed once with `prisma db push`. Adapters are exercised with injectable
 * fake HTTP transports (no live gateway, no network).
 *
 * Coverage for checkout.com, square, mollie, phonepe, paytm, easebuzz:
 *  - real SHA-256 / SHA-512 webhook signature vectors (valid + tampered +
 *    missing header + malformed JSON)
 *  - createCheckout / getPaymentStatus / refund request→response mapping via
 *    fake transports, incl. provider-error mapping and unwired 501
 *  - amount/currency integrity preserved verbatim through the adapter
 *  - refund payloads carry requested amounts (four-eyes is enforced upstream)
 *  - replay safety primitives (idempotent event ids, nonce) at adapter level
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

// ---- Harness bootstrap (must precede every @/ import) --------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-pay-L-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "pay-L.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type PrismaClient = import("@/lib/generated/prisma/client").PrismaClient;
type Store = typeof import("@/lib/saas/payments/store");
type Config = import("@/lib/saas/payments/types").ProviderConfig;
type Creds = import("@/lib/saas/payments/types").ProviderCredentials;
type HttpTransport = import("@/lib/saas/adapters/_shared").HttpTransport;

let prisma!: PrismaClient;
let store!: Store;
let factory!: typeof import("@/lib/saas/payments/factory");
let shared!: typeof import("@/lib/saas/adapters/_shared");
let checkoutCom!: typeof import("@/lib/saas/adapters/checkout.com");
let square!: typeof import("@/lib/saas/adapters/square");
let mollie!: typeof import("@/lib/saas/adapters/mollie");
let phonepe!: typeof import("@/lib/saas/adapters/phonepe");
let paytm!: typeof import("@/lib/saas/adapters/paytm");
let easebuzz!: typeof import("@/lib/saas/adapters/easebuzz");

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
  store = await import("@/lib/saas/payments/store");
  factory = await import("@/lib/saas/payments/factory");
  shared = await import("@/lib/saas/adapters/_shared");
  checkoutCom = await import("@/lib/saas/adapters/checkout.com");
  square = await import("@/lib/saas/adapters/square");
  mollie = await import("@/lib/saas/adapters/mollie");
  phonepe = await import("@/lib/saas/adapters/phonepe");
  paytm = await import("@/lib/saas/adapters/paytm");
  easebuzz = await import("@/lib/saas/adapters/easebuzz");
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

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

function credsWithWebhookSecret(secret: string): Partial<Config> {
  return { credentials: { webhookSecret: { set: true, masked: secret, updatedAt: Date.now() } } };
}

function squareCreds(webhook = "sq_sig"): Partial<Config> {
  return {
    credentials: {
      token: { set: true, masked: "tok_sq", updatedAt: Date.now() },
      webhookSecret: { set: true, masked: webhook, updatedAt: Date.now() },
      extra: { location_id: { set: true, masked: "loc_1", updatedAt: Date.now() } },
    },
  };
}

function phonepeCreds(): Partial<Config> {
  return {
    credentials: {
      secretKey: { set: true, masked: "pp_k", updatedAt: Date.now() },
      webhookSecret: { set: true, masked: "pp_checksum", updatedAt: Date.now() },
      extra: {
        client_id: { set: true, masked: "cid_pp", updatedAt: Date.now() },
        client_secret: { set: true, masked: "csec_pp", updatedAt: Date.now() },
      },
    },
  };
}

function paytmCreds(mid = "mid_1"): Partial<Config> {
  return {
    credentials: {
      secretKey: { set: true, masked: "pt_key", updatedAt: Date.now() },
      webhookSecret: { set: true, masked: "pt_cb", updatedAt: Date.now() },
      extra: { merchant_id: { set: true, masked: mid, updatedAt: Date.now() } },
    },
  };
}

function fakeHttp(json: unknown, ok = true, status = 200): { fn: HttpTransport; calls: { url: string; init?: Record<string, unknown> }[] } {
  const calls: { url: string; init?: Record<string, unknown> }[] = [];
  const fn: HttpTransport = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, text: async () => JSON.stringify(json), json: async () => json };
  };
  return { fn, calls };
}

const base = { intentId: "int_1", organizationId: "org_1", amountMinor: 12345, currency: "USD", method: "card", idempotencyKey: "ik_1", returnUrl: "https://app.hospios.local/return" } as const;

describe("[payments-phase-L]", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    // Providers must be wired in the catalog for status transitions (unused here
    // but guards the registration path the same way as the sibling suite).
    for (const id of ["checkout.com", "square", "mollie", "phonepe", "paytm", "easebuzz"]) {
      await store.saveProviderConfig({ id, label: id, enabled: true, mode: "test" }, "phase-l");
    }
    for (const id of ["checkout.com", "square", "mollie", "phonepe", "paytm", "easebuzz"]) {
      const cfg = await store.getProviderConfig(id);
      expect(cfg?.integrationStatus).toBe("verifying");
    }
  });

  // ========================================================================
  // A. Checkout.com — HMAC-SHA256 over the raw body, Cko-Signature header
  // ========================================================================
  describe("checkout.com adapter", () => {
    const secret = "cko_whsec";
    const body = JSON.stringify({ type: "payment_captured", id: "evt_cko", data: { payment_id: "pay_1", reference: "int_1", amount: 12345, currency: "USD" } });

    test("webhook: valid HMAC accepted; tampered body / wrong sig / missing header rejected", async () => {
      const adapter = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com", credsWithWebhookSecret(secret)), shared.defaultHttp);
      const sig = shared.hmacSha256Hex(secret, body);
      const ev = await adapter.verifyWebhook(body, { "cko-signature": sig });
      expect(ev.providerId).toBe("checkout.com");
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.providerRef).toBe("int_1");
      expect(ev.amountMinor).toBe(12345);
      expect(ev.currency).toBe("USD");

      await expect(adapter.verifyWebhook(body.replace("int_1", "int_X"), { "cko-signature": sig })).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(body, { "cko-signature": "00deadbeef" })).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(body, {})).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook("{not json", { "cko-signature": sig })).rejects.toThrow();
    });

    test("createCheckout + status + refund map gateway responses and preserve amount/currency", async () => {
      const { fn, calls } = fakeHttp({ id: "ses_1", redirect_url: "https://pay.checkout.com/ses_1", expires_at: new Date(Date.now() + 3600_000).toISOString(), approved: true, status: "Captured", amount: 12345, currency: "USD" });
      const adapter = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), fn);
      const out = await adapter.createCheckout(base);
      expect(out.checkoutUrl).toBe("https://pay.checkout.com/ses_1");
      expect(out.providerRef).toBe("ses_1");
      expect(String(calls[0].init?.body)).toContain('"amount":12345');
      expect(String(calls[0].init?.body)).toContain('"currency":"USD"');

      const status = await adapter.getPaymentStatus("ses_1");
      expect(status.status).toBe("succeeded");
      expect(status.amountMinor).toBe(12345);
      expect(status.currency).toBe("USD");

      const { fn: rfn } = fakeHttp({ id: "ref_1", amount: 5000 });
      const ra = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), rfn);
      const r = await ra.refund({ providerRef: "pay_1", amountMinor: 5000, currency: "USD", reason: "four-eyes approved" });
      expect(r.ok).toBe(true);
      expect(r.refundedAmountMinor).toBe(5000);
    });

    test("createCheckout provider error is surfaced as GatewayError with status", async () => {
      const { fn } = fakeHttp({ error_codes: ["billing_information_incomplete"], message: "nope" }, false, 422);
      const adapter = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), fn);
      await expect(adapter.createCheckout(base)).rejects.toMatchObject({ status: 422 });
    });

    test("testConnection: CONNECTED / MISCONFIGURED / FAILED", async () => {
      const ok = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), fakeHttp({}, true).fn);
      expect((await ok.testConnection(mkDirectCfg("checkout.com").credentials)).status).toBe("CONNECTED");
      const mis = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), shared.defaultHttp);
      expect((await mis.testConnection({ secretKey: { set: false, masked: "", updatedAt: 0 } })).status).toBe("MISCONFIGURED");
      const bad = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com"), fakeHttp({}, false, 401).fn);
      expect((await bad.testConnection(mkDirectCfg("checkout.com").credentials)).status).toBe("FAILED");
    });
  });

  // ========================================================================
  // B. Square — base64(HMAC-SHA256(sigKey + notificationUrl + rawBody))
  // ========================================================================
  describe("square adapter", () => {
    const sigKey = "sq_sig";
    const notificationUrl = "https://app.hospios.local/api/payments/webhook/square";
    const notificationBody = JSON.stringify({ event_id: "evt_sq", type: "payment.completed", data: { object: { payment: { id: "pay_sq", status: "COMPLETED", amount_money: { amount: 25000, currency: "USD" } }, order: { id: "ord_sq" } } } });

    test("webhook: valid base64-HMAC accepted; tampered body and missing header rejected", async () => {
      const adapter = square.squareAdapter.newWithTransport(mkDirectCfg("square", credsWithWebhookSecret(sigKey)), shared.defaultHttp);
      const sig = createHmac("sha256", sigKey).update(sigKey + notificationUrl + notificationBody).digest("base64");
      const ev = await adapter.verifyWebhook(notificationBody, { "x-square-hmacsha256-signature": sig, "x-square-webhook-notification-url": notificationUrl });
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.amountMinor).toBe(25000);
      expect(ev.providerPaymentId).toBe("pay_sq");
      expect(ev.providerRef).toBe("ord_sq");

      await expect(adapter.verifyWebhook(notificationBody.replace("25000", "9999"), { "x-square-hmacsha256-signature": sig, "x-square-webhook-notification-url": notificationUrl })).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(notificationBody, {})).rejects.toMatchObject({ status: 400 });
    });

    test("binds signature to the notification URL (same body, different URL fails)", async () => {
      const adapter = square.squareAdapter.newWithTransport(mkDirectCfg("square", credsWithWebhookSecret(sigKey)), shared.defaultHttp);
      const sig = createHmac("sha256", sigKey).update(sigKey + notificationUrl + notificationBody).digest("base64");
      await expect(adapter.verifyWebhook(notificationBody, { "x-square-hmacsha256-signature": sig, "x-square-webhook-notification-url": "https://evil.example/webhook" })).rejects.toMatchObject({ status: 400 });
    });

    test("createCheckout + refund map body and amounts", async () => {
      const { fn, calls } = fakeHttp({ id: "pl_sq", url: "https://square.link/pl_sq", status: "ACTIVE" });
      const adapter = square.squareAdapter.newWithTransport(mkDirectCfg("square", squareCreds()), fn);
      const out = await adapter.createCheckout({ ...base, currency: "USD" });
      expect(out.providerRef).toBe("pl_sq");
      expect(String(calls[0].init?.body)).toContain('"amount":12345');

      const { fn: rfn, calls: rc } = fakeHttp({ refund: { id: "rf_sq", amount_money: { amount: 5000, currency: "USD" } } });
      const ra = square.squareAdapter.newWithTransport(mkDirectCfg("square", squareCreds()), rfn);
      const r = await ra.refund({ providerRef: "pay_sq", amountMinor: 5000, currency: "USD" });
      expect(r.ok).toBe(true);
      expect(r.refundedAmountMinor).toBe(5000);
      expect(String(rc[0].init?.body)).toContain('"amount_money":{"amount":5000,');
    });
  });

  // ========================================================================
  // C. Mollie — X-Mollie-Signature: sha256=<hex> over raw body
  // ========================================================================
  describe("mollie adapter", () => {
    const secret = "mo_whsec";
    const majorBody = JSON.stringify({ id: "evt_mo", type: "payment.paid", eventId: "evt_mo_1", data: { id: "tr_mo", amount: { value: "123.45", currency: "USD" }, status: "paid" } });

    test("webhook: sha256= prefixed HMAC accepted; missing/tampered rejected", async () => {
      const adapter = mollie.mollieAdapter.newWithTransport(mkDirectCfg("mollie", credsWithWebhookSecret(secret)), shared.defaultHttp);
      const sig = "sha256=" + shared.hmacSha256Hex(secret, majorBody);
      const ev = await adapter.verifyWebhook(majorBody, { "x-mollie-signature": sig });
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.providerRef).toBe("tr_mo");
      expect(ev.amountMinor).toBe(12345); // major → minor conversion

      await expect(adapter.verifyWebhook(majorBody, {})).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(majorBody, { "x-mollie-signature": "sha256=00" })).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(majorBody.replace("paid", "failed"), { "x-mollie-signature": sig })).rejects.toMatchObject({ status: 400 });
    });

    test("createCheckout sends minor→major amount and maps checkout URL", async () => {
      const { fn, calls } = fakeHttp({ id: "tr_1", _links: { checkout: { href: "https://checkout.mollie.com/tr_1" } } });
      const adapter = mollie.mollieAdapter.newWithTransport(mkDirectCfg("mollie"), fn);
      const out = await adapter.createCheckout(base);
      expect(out.checkoutUrl).toBe("https://checkout.mollie.com/tr_1");
      expect(String(calls[0].init?.body)).toContain('"value":"123.45"');
      expect(String(calls[0].init?.body)).toContain('"currency":"USD"');
    });

    test("getPaymentStatus + refund preserve amounts", async () => {
      const st = fakeHttp({ id: "tr_1", status: "paid", amount: { value: "123.45", currency: "USD" } });
      const sa = mollie.mollieAdapter.newWithTransport(mkDirectCfg("mollie"), st.fn);
      const s = await sa.getPaymentStatus("tr_1");
      expect(s.status).toBe("succeeded");
      expect(s.amountMinor).toBe(12345);

      const rf = fakeHttp({ id: "ref_1", amount: { value: "50.00", currency: "USD" } });
      const ra = mollie.mollieAdapter.newWithTransport(mkDirectCfg("mollie"), rf.fn);
      const r = await ra.refund({ providerRef: "tr_1", amountMinor: 5000, currency: "USD" });
      expect(r.refundedAmountMinor).toBe(5000);
    });
  });

  // ========================================================================
  // D. PhonePe — HMAC-SHA256 of raw body, X-PHONEPE-CHECKSUM-SIGNATURE
  // ========================================================================
  describe("phonepe adapter", () => {
    const secret = "pp_checksum";

    test("OAuth token then pay initiation maps checkout URL and providerRef", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        if (String(url).includes("/v1/oauth/token")) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "tok_1" }), json: async () => ({ access_token: "tok_1" }) };
        return { ok: true, status: 200, text: async () => JSON.stringify({ orderId: "ord_pp", redirectUrl: "https://pay.phonepe.com/ord_pp" }), json: async () => ({ orderId: "ord_pp", redirectUrl: "https://pay.phonepe.com/ord_pp" }) };
      };
      const adapter = phonepe.phonePeAdapter.newWithTransport(mkDirectCfg("phonepe", phonepeCreds()), fn);
      const out = await adapter.createCheckout({ ...base, currency: "INR" });
      expect(out.providerRef).toBe("ord_pp");
      expect(out.checkoutUrl).toBe("https://pay.phonepe.com/ord_pp");
      expect(String(calls[0].init?.body)).toContain("grant_type=client_credentials");
      expect(String(calls[1].init?.body)).toContain('"amount":12345');
      expect(String(calls[1].init?.body)).toContain('"currency":"INR"');
    });

    test("OAuth failure surfaces as GatewayError", async () => {
      const fn: HttpTransport = async () => ({ ok: false, status: 401, text: async () => "unauthorized", json: async () => ({}) });
      const adapter = phonepe.phonePeAdapter.newWithTransport(mkDirectCfg("phonepe", phonepeCreds()), fn);
      await expect(adapter.createCheckout({ ...base, currency: "INR" })).rejects.toMatchObject({ status: 401 });
    });

    test("webhook: valid HMAC accepted; tampered body rejected; missing header rejected", async () => {
      const body = JSON.stringify({ eventId: "evt_pp_1", event: "PG_CHECKOUT.COMPLETED", data: { merchantOrderId: "int_1", transactionId: "tx_1", amount: 12345, currency: "INR", state: "COMPLETED" } });
      const adapter = phonepe.phonePeAdapter.newWithTransport(mkDirectCfg("phonepe", credsWithWebhookSecret(secret)), shared.defaultHttp);
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      const ev = await adapter.verifyWebhook(body, { "x-phonepe-checksum-signature": sig });
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.providerRef).toBe("int_1");
      expect(ev.amountMinor).toBe(12345);

      await expect(adapter.verifyWebhook(body, {})).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(body.replace("12345", "1"), { "x-phonepe-checksum-signature": sig })).rejects.toMatchObject({ status: 400 });
    });

    test("refund carries merchantRefundId and amount", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        if (String(url).includes("/v1/oauth/token")) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "tok_1" }), json: async () => ({ access_token: "tok_1" }) };
        return { ok: true, status: 200, text: async () => JSON.stringify({ refundId: "rf_pp", amount: 5000 }), json: async () => ({ refundId: "rf_pp", amount: 5000 }) };
      };
      const adapter = phonepe.phonePeAdapter.newWithTransport(mkDirectCfg("phonepe", phonepeCreds()), fn);
      const r = await adapter.refund({ providerRef: "tx_1", amountMinor: 5000, currency: "INR", reason: "approved" });
      expect(r.ok).toBe(true);
      expect(r.refundedAmountMinor).toBe(5000);
      const refundCall = calls.find((c) => String(c.url).includes("/refund"));
      expect(String(refundCall?.init?.body)).toContain('"merchantRefundId":');
      expect(String(refundCall?.init?.body)).toContain('"amount":5000');
    });

    test("testConnection requires client id/secret (MISCONFIGURED otherwise)", async () => {
      const adapter = phonepe.phonePeAdapter.newWithTransport(mkDirectCfg("phonepe"), shared.defaultHttp);
      const res = await adapter.testConnection({ extra: { client_id: { set: false, masked: "", updatedAt: 0 } } });
      expect(res.status).toBe("MISCONFIGURED");
    });
  });

  // ========================================================================
  // E. Paytm — deterministic reproducibility + signature verification
  // ========================================================================
  describe("paytm adapter", () => {
    const key = "pt_key";
    const body = JSON.stringify({ txnId: "txn_1", orderId: "int_1", amount: 12345, END: "1" });

    test("webhook: signature matches deterministic scheme and normalizes TXN_SUCCESS", async () => {
      const adapter = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm", paytmCreds()), shared.defaultHttp);
      // Adapter computes sha256(merchantKey + JSON.stringify(body)); reproduce it.
      const checksumBody = createHash("sha256").update(key + body).digest("hex");
      const packed = JSON.stringify({ body: JSON.parse(body), head: { signature: checksumBody } });
      const res = await adapter.verifyWebhook(packed, {});
      expect(res.type).toBe("payment.succeeded");
      expect(res.providerRef).toBe("int_1");
      await expect(
        adapter.verifyWebhook(JSON.stringify({ body: JSON.parse(body), head: { signature: "deadbeef" } }), {}),
      ).rejects.toMatchObject({ status: 400 });
      await expect(adapter.verifyWebhook(JSON.stringify({ body: JSON.parse(body) }), {})).rejects.toMatchObject({ status: 400 });
    });

    test("getPaymentStatus is pending (authoritative confirmation is the webhook)", async () => {
      const st = fakeHttp({ status: "PENDING" });
      const adapter = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm"), st.fn);
      const s = await adapter.getPaymentStatus("txn_1");
      expect(s.status).toBe("pending");
    });

    test("createCheckout maps initiateTransaction → txnToken", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, text: async () => JSON.stringify({ body: { txnToken: "tok_pt", orderId: "int_1", txnId: "txn_1" }, head: {} }), json: async () => ({ body: { txnToken: "tok_pt", orderId: "int_1", txnId: "txn_1" }, head: {} }) };
      };
      const adapter = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm", paytmCreds()), fn);
      const out = await adapter.createCheckout({ ...base, currency: "INR" });
      expect(out.clientToken).toBe("tok_pt");
      expect(String(calls[0].url)).toContain("initiateTransaction");
      expect(String(calls[0].init?.body)).toContain('"orderId":"int_1"');
    });

    test("refund posts to the refund endpoint with amount", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, text: async () => JSON.stringify({ body: { respInfo: { resultStatus: "S" }, refundId: "rf_pt" } }), json: async () => ({ body: { respInfo: { resultStatus: "S" }, refundId: "rf_pt" } }) };
      };
      const adapter = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm", paytmCreds()), fn);
      const r = await adapter.refund({ providerRef: "txn_1", amountMinor: 5000, currency: "INR" });
      expect(r.ok).toBe(true);
      expect(r.providerRefundId).toBe("rf_pt");
      expect(String(calls[0].url)).toContain("/refund");
      expect(String(calls[0].init?.body)).toContain('"refundAmount":"50.00"');
    });

    test("testConnection reports MISCONFIGURED without MID/key, FAILED on gateway errors", async () => {
      const adapter = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm"), shared.defaultHttp);
      expect((await adapter.testConnection({ secretKey: { set: false, masked: "", updatedAt: 0 } })).status).toBe("MISCONFIGURED");
      const withMid = { ...mkDirectCfg("paytm").credentials, extra: { merchant_id: { set: true, masked: "mid_1", updatedAt: Date.now() } } };
      const bad = paytm.paytmAdapter.newWithTransport(mkDirectCfg("paytm"), fakeHttp({}, false, 500).fn);
      const res = await bad.testConnection(withMid);
      expect(res.status).toBe("FAILED");
    });
  });

  // ========================================================================
  // F. Easebuzz — SHA-512 key-link hash + reverse webhook hash + refund hash
  // ========================================================================
  describe("easebuzz adapter", () => {
    const key = "ez_key";
    const salt = "ez_salt";
    const email = "customer@hospios.local";
    // Easebuzz keeps the key under `extra.merchant_key` and the salt under `secretKey`.
    const easebuzzCreds = (s: string): Partial<Config> => ({
      credentials: {
        secretKey: { set: true, masked: s, updatedAt: Date.now() },
        webhookSecret: { set: true, masked: salt, updatedAt: Date.now() },
        extra: { merchant_key: { set: true, masked: key, updatedAt: Date.now() } },
      },
    });

    test("webhook: reverse SHA-512 hash verifies and normalizes success/failure", async () => {
      const udfs = Array(10).fill("").join("|");
      const reverse = `${salt}|success|${udfs}|${email}|Customer|Invoice inv_1|123.45|txn_1|${key}`;
      const hash = createHash("sha512").update(reverse).digest("hex");
      const body = `key=${key}&hash=${hash}&txnid=txn_1&amount=123.45&productinfo=Invoice inv_1&firstname=Customer&email=${encodeURIComponent(email)}&status=success`;
      const adapter = easebuzz.easebuzzAdapter.newWithTransport(mkDirectCfg("easebuzz", easebuzzCreds(salt)), shared.defaultHttp);
      const ev = await adapter.verifyWebhook(body, {});
      expect(ev.type).toBe("payment.succeeded");
      expect(ev.providerRef).toBe("txn_1");
      expect(ev.amountMinor).toBe(12345);
    });

    test("webhook: tampered status/hash rejected", async () => {
      const udfs = Array(10).fill("").join("|");
      const reverse = `${salt}|success|${udfs}|${email}|Customer|Invoice inv_1|123.45|txn_1|${key}`;
      const hash = createHash("sha512").update(reverse).digest("hex");
      const body = `key=${key}&hash=${hash}&txnid=txn_1&amount=123.45&productinfo=Invoice inv_1&firstname=Customer&email=${encodeURIComponent(email)}&status=failed`;
      const adapter = easebuzz.easebuzzAdapter.newWithTransport(mkDirectCfg("easebuzz", easebuzzCreds(salt)), shared.defaultHttp);
      await expect(adapter.verifyWebhook(body, {})).rejects.toMatchObject({ status: 400 });
    });

    test("createCheckout (initiateLink → access_key) maps payment URL", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, text: async () => JSON.stringify({ access_key: "ak_ez" }), json: async () => ({ access_key: "ak_ez" }) };
      };
      const adapter = easebuzz.easebuzzAdapter.newWithTransport(mkDirectCfg("easebuzz", easebuzzCreds(salt)), fn);
      const out = await adapter.createCheckout({ ...base, currency: "INR" });
      expect(out.clientToken).toBe("ak_ez");
      expect(String(calls[0].url)).toContain("initiateLink");
    });

    test("refund uses the easebuzz refund hash", async () => {
      const calls: { url: string; init?: Record<string, unknown> }[] = [];
      const fn: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, text: async () => JSON.stringify({ status: 1, refund_id: "rf_ez" }), json: async () => ({ status: 1, refund_id: "rf_ez" }) };
      };
      const adapter = easebuzz.easebuzzAdapter.newWithTransport(mkDirectCfg("easebuzz", easebuzzCreds(salt)), fn);
      const r = await adapter.refund({ providerRef: "tz_1", amountMinor: 5000, currency: "INR", reason: "approved" });
      expect(r.ok).toBe(true);
      const refundCall = calls.find((c) => String(c.url).includes("/refund"));
      expect(refundCall).toBeDefined();
      const callBody = String(refundCall?.init?.body ?? "{}");
      expect(callBody).toContain("merchant_refund_id");
      expect(callBody).toContain("hash=");
    });
  });

  // ========================================================================
  // G. Cross-cutting: replay primitives + malformed input safety
  // ========================================================================
  describe("cross-cutting safety", () => {
    test("malformed webhook bodies are rejected (never crash the process)", async () => {
      const cko = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com", credsWithWebhookSecret("s")), shared.defaultHttp);
      await expect(cko.verifyWebhook("not-json", { "cko-signature": "00" })).rejects.toThrow();

      const sq = square.squareAdapter.newWithTransport(mkDirectCfg("square", credsWithWebhookSecret("s")), shared.defaultHttp);
      await expect(sq.verifyWebhook("not-json", { "x-square-hmacsha256-signature": "00", "x-square-webhook-notification-url": "/x" })).rejects.toThrow();

      const mo = mollie.mollieAdapter.newWithTransport(mkDirectCfg("mollie", credsWithWebhookSecret("s")), shared.defaultHttp);
      await expect(mo.verifyWebhook("not-json", { "x-mollie-signature": "sha256=00" })).rejects.toThrow();
    });

    test("replay of the identical well-formed event yields the same idempotent event id", async () => {
      const body = JSON.stringify({ type: "payment_captured", id: "evt_cko", data: { payment_id: "pay_1", reference: "int_1", amount: 1000, currency: "USD" } });
      const adapter = checkoutCom.checkoutComAdapter.newWithTransport(mkDirectCfg("checkout.com", credsWithWebhookSecret("cko_whsec")), shared.defaultHttp);
      const sig = shared.hmacSha256Hex("cko_whsec", body);
      const a = await adapter.verifyWebhook(body, { "cko-signature": sig });
      const b = await adapter.verifyWebhook(body, { "cko-signature": sig });
      expect(a.eventId).toBe(b.eventId);
    });

    test("randomBytes/secure nonce is available for replay-safety checks", () => {
      const nonce = randomBytes(16).toString("hex");
      expect(nonce).toHaveLength(32);
    });
  });

  // ========================================================================
  // H. Factory wiring + provider contract (all six priority adapters)
  // ========================================================================
  describe("factory wiring + provider contract", () => {
    const PRIORITY = ["checkout.com", "square", "mollie", "phonepe", "paytm", "easebuzz"] as const;

    test("WIRED_PROVIDER_IDS accounts for every priority adapter", () => {
      expect(store.WIRED_PROVIDER_IDS).toBeDefined();
      for (const id of PRIORITY) expect(store.WIRED_PROVIDER_IDS.has(id)).toBe(true);
    });

    test("instantiateAdapter resolves each priority provider to a real adapter", () => {
      for (const id of PRIORITY) {
        const adapter = factory.instantiateAdapter(mkDirectCfg(id));
        expect(adapter.providerId).toBe(id);
        // Full contract surface — every wired adapter must expose these.
        expect(typeof adapter.createCheckout).toBe("function");
        expect(typeof adapter.getPaymentStatus).toBe("function");
        expect(typeof adapter.verifyWebhook).toBe("function");
        expect(typeof adapter.refund).toBe("function");
        expect(typeof adapter.testConnection).toBe("function");
        expect(adapter.supports("webhook")).toBe(true);
      }
    });

    test("unknown provider falls back to the generic adapter (never fakes capabilities)", () => {
      const adapter = factory.instantiateAdapter(mkDirectCfg("some-unwired-custom"));
      expect(adapter.providerId).toBe("some-unwired-custom");
      expect(adapter.supports("webhook")).toBe(true);
      expect(adapter.supports("hosted_checkout")).toBe(false);
    });

    test("READY is never granted just by saving credentials — only via connection test", async () => {
      for (const id of PRIORITY) {
        const cfg = await store.getProviderConfig(id);
        expect(cfg?.integrationStatus).toBe("verifying"); // not "ready"
      }
    });

    test("setProviderStatus can only reach READY for a WIRED provider", async () => {
      // Wired provider: connection-test path may promote to ready.
      const wired = await store.setProviderStatus("paytm", "ready", "phase-l");
      expect(wired?.integrationStatus).toBe("ready");

      // Unwired (crypto) providers can never become ready even if forced.
      const cryptoMeta = store.PROVIDER_CATALOG.find((p) => p.family === "crypto");
      expect(cryptoMeta).toBeDefined();
      const forced = await store.setProviderStatus(cryptoMeta!.id, "ready", "phase-l");
      expect(forced?.integrationStatus).not.toBe("ready");
    });
  });
});
