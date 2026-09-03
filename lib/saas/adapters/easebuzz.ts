/**
 * Easebuzz Payment Gateway (India) — hosted initiate-payment redirect.
 *
 * Auth: merchant key + SHA-512 hash signed with the salt. The server calls
 * `initiate_payment` and redirects the browser to Easebuzz's hosted page — card
 * cash never touches the HospiOS server (SAQ-A). Confirmation is authoritative
 * only via the (hash-signed) transaction webhook + Transaction Status API.
 *
 * Signing: initiate/response hashes are SHA-512 over the documented field
 * concatenation using the salt. Field order is endpoint-specific — READY is
 * only granted after real sandbox verification confirms each hash.
 * @docs: https://docs.easebuzz.in/docs/payment-gateway
 */
import { createHash } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { matchSignature, defaultHttp, GatewayError, readRecord, readString, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

export class EasebuzzAdapter extends PaymentProviderAdapter {
  readonly providerId = "easebuzz";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode",
  ] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private key(): string {
    const k = this.cfg.credentials.extra?.merchant_key?.masked ?? "";
    if (!k) throw new GatewayError("Provider \"easebuzz\" merchant key not configured", 503);
    return k;
  }
  private salt(): string {
    const s = this.cfg.credentials.secretKey?.masked ?? "";
    if (!s) throw new GatewayError("Provider \"easebuzz\" salt not configured", 503);
    return s;
  }

  private base(): string {
    return this.cfg.mode === "test" ? "https://pay.easebuzz.in" : "https://pay.easebuzz.in";
  }

  private sha512(s: string): string {
    return createHash("sha512").update(s).digest("hex");
  }

  // initiate hash: SHA512(key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt)
  private initiateHash(t: { txnid: string; amount: string; productinfo: string; firstname: string; email: string }): string {
    const udfs = Array(10).fill("").join("|");
    const joined = [this.key(), t.txnid, t.amount, t.productinfo, t.firstname, t.email, udfs, this.salt()].join("|");
    return this.sha512(joined);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const txnid = input.intentId;
    const amount = (input.amountMinor / 100).toFixed(2);
    const firstname = "HospiOS Customer";
    const email = "customer@hospios.local";
    const productinfo = `Invoice ${input.invoiceId ?? "payment"}`;
    const hash = this.initiateHash({ txnid, amount, productinfo, firstname, email });

    const body = new URLSearchParams({
      key: this.key(),
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone: "",
      surl: input.returnUrl ?? `/customer/checkout/${input.intentId}`,
      furl: input.cancelUrl ?? `/customer/billing`,
      hash,
      udf1: input.organizationId,
      udf2: input.intentId,
    });

    const res = await this.http(`${this.base()}/payment/initiateLink`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = readRecord(await res.json());
    if (!res.ok || !data.access_key) {
      throw new GatewayError(`Easebuzz initiate failed: ${readString(data.error_desc) || readString(data.error) || "unknown"}`, res.status);
    }
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: `${this.base()}/pay/${readString(data.access_key)}`,
      clientToken: readString(data.access_key),
      providerRef: txnid,
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    // txnid is the status reference; canonical confirmation via webhook.
    return { providerRef, status: "pending", amountMinor: null, currency: null };
  }

  async verifyWebhook(rawBody: string, _headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    // Easebuzz posts form-encoded params with a reverse `hash` over
    // salt|status|udf10..udf1|email|firstname|productinfo|amount|txnid|key.
    const params = new URLSearchParams(rawBody);
    const key = params.get("key") ?? this.key();
    const txnid = params.get("txnid") ?? "";
    const amount = params.get("amount") ?? "0";
    const productinfo = params.get("productinfo") ?? "";
    const firstname = params.get("firstname") ?? "";
    const email = params.get("email") ?? "";
    const status = params.get("status") ?? "";
    const provided = params.get("hash") ?? "";
    if (!provided) throw new GatewayError("Missing Easebuzz hash", 400);
    const udfs = ["udf10","udf9","udf8","udf7","udf6","udf5","udf4","udf3","udf2","udf1"]
      .map((n) => params.get(n) ?? "")
      .join("|");
    const joined = [this.salt(), status, udfs, email, firstname, productinfo, amount, txnid, key].join("|");
    if (!matchSignature(this.sha512(joined), provided)) throw new GatewayError("Easebuzz hash mismatch", 400);

    const eventId = String(params.get("easebuzz_id") ?? `${txnid}-${Date.now()}`);
    let normType: PaymentWebhookEvent["type"];
    if (status === "success" || status === "successful" || status === "completed") normType = "payment.succeeded";
    else if (status === "failure" || status === "failed") normType = "payment.failed";
    else if (status === "refunded" || status === "refund") normType = "payment.refunded";
    else normType = "payment.succeeded";

    return {
      providerId: this.providerId,
      eventId,
      type: normType,
      providerRef: txnid,
      providerPaymentId: String(params.get("easebuzz_id") ?? null),
      amountMinor: Math.round(Number(amount) * 100),
      currency: "INR",
      refundAmountMinor: normType === "payment.refunded" ? Math.round(Number(amount) * 100) : undefined,
      method: toNormMethod(String(params.get("payment_source") ?? params.get("pg") ?? "")),
      raw: Object.fromEntries(params) as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    // Refund API: SHA512(merchant_email|key|refund_amount|easebuzz_id|merchant_refund_id|salt)
    const refundId = `ref_${Date.now()}`;
    const merchantEmail = String(this.cfg.credentials.extra?.merchant_email?.masked ?? "");
    const easebuzzId = input.providerRef;
    const refundAmount = (input.amountMinor / 100).toFixed(2);
    const hash = this.sha512([merchantEmail, this.key(), refundAmount, easebuzzId, refundId, this.salt()].join("|"));

    const body = new URLSearchParams({ key: this.key(), easebuzz_id: easebuzzId, refund_amount: refundAmount, merchant_refund_id: refundId, merchant_email: merchantEmail, hash });
    const res = await this.http(`${this.base()}/refund/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = readRecord(await res.json());
    if (!res.ok || readString(data.refund_status) === "failure") {
      throw new GatewayError(`Easebuzz refund failed: ${readString(data.error_desc) || readString(data.error) || "unknown"}`, res.status);
    }
    return { ok: true, refundedAmountMinor: input.amountMinor, providerRefundId: readString(data.refund_id) || refundId };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const key = credentials.extra?.merchant_key?.masked ?? "";
    const salt = credentials.secretKey?.masked ?? "";
    if (!key || !salt) return { status: "MISCONFIGURED", error: "Missing Easebuzz key/salt" };
    try {
      // Reachability: a minimal initiate with no live charge.
      const txnid = `conn_${Date.now()}`;
      const hash = this.sha512([key, txnid, "1.00", "connection", "test", "test@local", Array(10).fill("").join("|"), salt].join("|"));
      const body = new URLSearchParams({ key, txnid, amount: "1.00", productinfo: "connection", firstname: "test", email: "test@local", phone: "", surl: "", furl: "", hash });
      const res = await this.http(`${this.base()}/payment/initiateLink`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Easebuzz connection failed (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

function toNormMethod(pg: string): PaymentWebhookEvent["method"] {
  const m = (pg || "").toLowerCase();
  if (m.includes("upi")) return "upi";
  if (m.includes("nb") || m.includes("netbank")) return "netbanking";
  if (m.includes("wallet")) return "wallet";
  if (m.includes("card")) return "card";
  if (m.includes("emi")) return "emi";
  return null;
}

export const easebuzzAdapter = {
  instance: (cfg: ProviderConfig) => new EasebuzzAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new EasebuzzAdapter(cfg, http),
};
