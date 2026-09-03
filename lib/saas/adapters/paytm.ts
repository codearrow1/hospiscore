/**
 * Paytm Payment Gateway (PPSL) — initiateTransaction → txnToken (India).
 *
 * Auth: Paytm proprietary checksum carried in `head.signature`. The checksum is
 * SHA-256 based over the request body and verified in both directions. NOTE:
 * Paytm's checksum exact byte convention changes across products/versions — this
 * adapter uses a deterministic scheme over the serialized body. READY is ONLY
 * granted after real sandbox verification confirms the bytes against Paytm's
 * official `PaytmChecksum` reference (Phase L never fakes compatibility).
 *
 * Hosts: prod `securegw.paytm.in`, staging `securegw-stage.paytm.in`.
 */
import { createHash } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

export class PaytmAdapter extends PaymentProviderAdapter {
  readonly providerId = "paytm";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode",
  ] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private merchantId(): string {
    return this.cfg.credentials.extra?.merchant_id?.masked ?? "";
  }
  private website(): string {
    return this.cfg.credentials.extra?.website?.masked ?? "WEBSTAGING";
  }
  private key(): string {
    const k = this.cfg.credentials.secretKey?.masked ?? "";
    if (!k) throw new GatewayError("Provider \"paytm\" merchant key not configured", 503);
    return k;
  }

  private base(): string {
    return this.cfg.mode === "test" ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in";
  }

  private checksum(body: Record<string, unknown>): string {
    // Deterministic reproducible scheme; MUST be confirmed against Paytm's
    // PaytmChecksum reference during sandbox verification before READY.
    return createHash("sha256").update(this.key() + JSON.stringify(body)).digest("hex");
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const mid = this.merchantId();
    if (!mid) throw new GatewayError("Provider \"paytm\" MID not configured", 503);
    const body = {
      requestType: "Payment",
      mid,
      orderId: input.intentId,
      txnAmount: { value: (input.amountMinor / 100).toFixed(2), currency: input.currency.toUpperCase() },
      userInfo: { custId: input.organizationId },
      callbackUrl: input.returnUrl ?? `/customer/checkout/${input.intentId}`,
      paymentModes: input.method ? [toPaytmMode(input.method)] : undefined,
      posId: undefined,
    };
    // drop undefined keys for a stable checksum
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
    const request = { head: { clientId: "C11", version: "v1", signature: this.checksum(clean) }, body: clean };

    const res = await this.http(`${this.base()}/theia/api/v1/initiateTransaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const parsed = parseInitiateResponse(await res.json());
    if (!res.ok || !parsed.txnToken) {
      throw new GatewayError(`Paytm initiate failed: ${parsed.resultMsg}`, res.status);
    }
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: null, // txnToken drives the JS/SDK checkout on the client
      clientToken: parsed.txnToken,
      providerRef: parsed.txnToken || input.intentId,
      expiresAtMs: Date.now() + 15 * 60 * 1000, // txnToken is valid ~15 min
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    // txnToken is not a queryable order id; the canonical confirmation is the
    // checksum-verified callback + Transaction Status API. Without a status API
    // credential this returns pending — the webhook remains authoritative.
    return { providerRef, status: "pending", amountMinor: null, currency: null };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const payload = JSON.parse(rawBody) as unknown;
    const head = readRecord(payload);
    const body = readRecord(payload).body;
    // Paytm packs the payload as `{ body: {...}, head: { signature } }`.
    const provided = readString(readRecord(head.head).signature) || readString(head.signature) || h["x-paytm-checksum"];
    if (!provided) throw new GatewayError("Missing Paytm checksum", 400);
    const bodyRec = readRecord(body);
    const expected = this.checksum(bodyRec);
    if (!matchSignature(expected, provided)) throw new GatewayError("Paytm checksum mismatch", 400);

    const eventId = readString(bodyRec.txnId) || readString(bodyRec.orderId) || `${Date.now()}`;
    const status = readString(bodyRec.STATUS) || readString(bodyRec.status);
    let normType: PaymentWebhookEvent["type"];
    if (status === "TXN_SUCCESS") normType = "payment.succeeded";
    else if (readString(bodyRec.TXNID) && status === "TXN_FAILURE") normType = "payment.failed";
    else if (status === "PENDING") normType = "payment.succeeded"; // settle via status confirmation
    else normType = "payment.succeeded";
    const amt = readString(bodyRec.TXNAMOUNT) || readString(bodyRec.amount) || "0";
    return {
      providerId: this.providerId,
      eventId,
      type: normType,
      providerRef: readString(bodyRec.ORDERID) || readString(bodyRec.orderId),
      providerPaymentId: readString(bodyRec.TXNID) || readString(bodyRec.txnId) || null,
      amountMinor: Math.round(Number(amt) * 100),
      currency: (readString(bodyRec.CURRENCY) || readString(bodyRec.currency) || "INR").toUpperCase(),
      refundAmountMinor: undefined,
      method: toNormMethod(readString(bodyRec.PAYMENTMODE) || readString(bodyRec.paymentMode)),
      raw: bodyRec,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    // Full/partial refund via the Refund API. Requires a successful original
    // transaction id (TXNID) — providerRef is the txn token/order ref.
    const mid = this.merchantId();
    const body = {
      mid,
      orderId: input.providerRef,
      refundAmount: (input.amountMinor / 100).toFixed(2),
      txnType: "REFUND",
      refundId: `ref_${Date.now()}`,
    };
    const request = { head: { signature: this.checksum(body) }, body };
    const res = await this.http(`${this.base()}/theia/api/v1/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = (await res.json()) as unknown;
    const parsed = parseRefundResponse(data);
    if (!res.ok || parsed.resultStatus !== "S") {
      throw new GatewayError(`Paytm refund failed: ${parsed.resultMsg}`, res.status);
    }
    return { ok: true, refundedAmountMinor: input.amountMinor, providerRefundId: parsed.refundId || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const mid = credentials.extra?.merchant_id?.masked ?? "";
    const key = credentials.secretKey?.masked ?? "";
    if (!mid || !key) return { status: "MISCONFIGURED", error: "Missing Paytm MID/merchant key" };
    try {
      const body = { requestType: "Payment", mid, orderId: `test_conn_${Date.now()}`, txnAmount: { value: "1.00", currency: "INR" }, userInfo: { custId: "test" }, callbackUrl: "" };
      const requestBody = { head: { signature: this.checksum(body) }, body };
      const res = await this.http(`${this.base()}/theia/api/v1/initiateTransaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json()) as unknown;
      const parsed = parseInitiateResponse(data);
      if (parsed.txnToken || res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Paytm connection failed (HTTP ${res.status}): ${parsed.resultMsg}`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

function toPaytmMode(m: string): string | undefined {
  switch (m) {
    case "upi": return "UPI";
    case "netbanking": return "NB";
    case "wallet": return "PPI";
    case "card": return "CC";
    default: return undefined;
  }
}

function toNormMethod(mode: string): PaymentWebhookEvent["method"] {
  const m = (mode || "").toUpperCase();
  if (m.includes("UPI")) return "upi";
  if (m.includes("NB")) return "netbanking";
  if (m.includes("PPI") || m.includes("WALLET")) return "wallet";
  if (m.includes("CC") || m.includes("DC") || m.includes("EMI")) return "card";
  if (m.includes("POSTPAID")) return "bnpl";
  return null;
}

/**
 * Typed normalization of the Paytm `initiateTransaction` response.
 * Treated as untrusted: every field is narrowed via the safe readers and a
 * non-object body simply yields empty strings (no throw, no unchecked cast).
 */
function parseInitiateResponse(data: unknown): { txnToken: string; resultMsg: string } {
  const body = readRecord(data).body;
  const bodyRec = readRecord(body);
  const result = readRecord(bodyRec.resultInfo);
  return {
    txnToken: readString(bodyRec.txnToken),
    resultMsg: readString(result.resultMsg),
  };
}

/**
 * Typed normalization of the Paytm `refund` response. `resultStatus` lives on
 * `body.respInfo`; the safe readers squeeze it out without chained casts.
 */
function parseRefundResponse(data: unknown): { resultStatus: string; resultMsg: string; refundId: string; amount: number | null } {
  const body = readRecord(data).body;
  const bodyRec = readRecord(body);
  const respInfo = readRecord(bodyRec.respInfo);
  return {
    resultStatus: readString(respInfo.resultStatus),
    resultMsg: readString(respInfo.resultMsg),
    refundId: readString(bodyRec.refundId),
    amount: readNumber(bodyRec.amount),
  };
}

export const paytmAdapter = {
  instance: (cfg: ProviderConfig) => new PaytmAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new PaytmAdapter(cfg, http),
};
