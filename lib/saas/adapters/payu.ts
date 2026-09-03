/**
 * PayU adapter (integrationStatus: "verify").
 * PayU India: orders via S2S create; transaction-status webhooks carry a
 * reverse-hash computed as SHA-512 over concatenated transaction fields plus
 * the merchant SALT. Hosted checkout via `payment_related_details_for_mobile_sdk`
 * / redirect to the pay page with the hash.
 */
import { createHash } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { defaultHttp, GatewayError, matchSignature, readRecord, readString, readNumber, type HttpTransport } from "./_shared";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

function sha512(payload: string): string {
  return createHash("sha512").update(payload).digest("hex");
}

const INDIA_PAY = "https://payu.in";
const INDIA_API = "https://test.in.payu.in";

export class PayUAdapter extends PaymentProviderAdapter {
  readonly providerId = "payu";
  protected readonly capabilities = ["hosted_checkout", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private creds(): { key: string; salt: string; merchantHash?: string } {
    const key = this.cfg.credentials.extra?.merchant_key?.masked ?? this.cfg.credentials.publishableKey ?? "";
    const salt = this.cfg.credentials.secretKey?.masked ?? "";
    const merchantHash = this.cfg.credentials.extra?.merchant_hash?.masked ?? "";
    if (!key || !salt) throw new GatewayError("Provider \"payu\" is not configured", 503);
    return { key, salt, merchantHash };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const { key, salt } = this.creds();
    const productinfo = `Invoice ${input.invoiceId ?? "payment"}`;
    const hashString = `${key}|${input.idempotencyKey}|${(input.amountMinor / 100).toFixed(2)}|${productinfo}|${input.organizationId}|||test||||||||||${salt}`;
    const hash = sha512(hashString);
    const res = await this.http(`${INDIA_API}/_payment`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key,
        txnid: input.idempotencyKey,
        amount: (input.amountMinor / 100).toFixed(2),
        productinfo,
        firstname: input.organizationId,
        email: "billing@hospios.app",
        phone: "",
        surl: input.returnUrl ?? "",
        furl: input.cancelUrl ?? "",
        hash,
        pg: "NB",
        bankcode: "CC",
      }).toString(),
    });
    const html = await res.text();
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: `${INDIA_PAY}/_payment`,
      clientToken: html, // PayU posts a form — the handler posts it for hosted flow
      providerRef: input.idempotencyKey,
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const { key, merchantHash } = this.creds();
    if (!merchantHash) throw new GatewayError("Provider \"payu\" merchant_hash not configured", 503);
    const hashString = `${merchantHash}|${key}|${providerRef}`;
    const res = await this.http(`${INDIA_API}/transaction/statusAPI/status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key, command: "verify_payment", var1: providerRef, hash: sha512(hashString), var2: "", var3: "", var4: "", var5: "" }).toString(),
    });
    const data = readRecord(await res.json());
    const details = readRecord(data.transaction_details);
    const txn = readRecord(details[providerRef]);
    const status = readString(readRecord(txn.status ? txn : details).status) || readString(data.status) || readString(txn.status);
    const failed = ["failure", "cancel"].includes(status.toLowerCase());
    return {
      providerRef,
      status: status.toLowerCase() === "success" ? "succeeded" : failed ? "failed" : "pending",
      amountMinor: txn.amount != null ? (() => { const v = readNumber(txn.amount); return v == null || !Number.isFinite(v) ? null : Math.round(v * 100); })() : null,
      currency: txn.currency != null ? readString(txn.currency) : null,
      providerPaymentId: providerRef,
    };
  }

  async verifyWebhook(rawBody: string, _headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const { salt } = this.creds();
    const params = new URLSearchParams(rawBody);
    const txnid = (params.get("txnid") ?? params.get("order_id") ?? "").trim();
    const status = (params.get("status") ?? params.get("txnStatus") ?? "").trim();
    const amount = (params.get("amount") ?? params.get("txnAmount") ?? "").trim();
    const productinfo = (params.get("productinfo") ?? params.get("productinfo1") ?? "").trim();
    const firstname = (params.get("firstname") ?? params.get("customer_name") ?? "").trim();
    const email = (params.get("email") ?? params.get("customer_email") ?? "billing@hospios.app").trim();
    const mihpayid = (params.get("mihpayid") ?? params.get("payuMoneyId") ?? txnid).trim();
    const mode = (params.get("mode") ?? "").trim();

    const reverseHash = sha512(`${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}||||||||||${mihpayid}`);
    const providedHash = (params.get("hash") ?? params.get("reverseHash") ?? "").trim();
    if (!providedHash || !matchSignature(reverseHash, providedHash)) {
      throw new GatewayError("PayU reverse-hash mismatch", 400);
    }
    const failure = status.toLowerCase() === "failure" || status.toLowerCase() === "cancel";

    return {
      providerId: this.providerId,
      eventId: `${txnid}-${mihpayid}`,
      type: failure ? "payment.failed" : "payment.succeeded",
      providerRef: txnid,
      providerPaymentId: mihpayid,
      amountMinor: amount ? Math.round(Number(amount) * 100) : null,
      currency: params.get("currency") || "INR",
      refundAmountMinor: undefined,
      method: mode ? normalizePayUMethod(mode) : null,
      raw: Object.fromEntries(params.entries()) as never,
    };
  }

  async refund(_input: RefundInput): Promise<ProviderRefundResult> {
    // PayU India flows refunds through the dashboard/S2S cancel-refund API.
    throw new GatewayError("Provider \"payu\" refund not implemented (use provider dashboard)", 501);
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const key = credentials.extra?.merchant_key?.masked ?? credentials.publishableKey ?? "";
    const salt = credentials.secretKey?.masked ?? "";
    if (!key || !salt) return { status: "MISCONFIGURED", error: "Missing key/salt" };
    // No safe stateless ping exists for PayU India; cannot confirm readiness
    // without charging. Never promotes to "ready".
    return { status: "UNSUPPORTED", error: "Provider has no safe connection test; verify at first charge" };
  }
}

function normalizePayUMethod(m: string): PaymentWebhookEvent["method"] {
  const t = m.toLowerCase();
  if (t.includes("netbanking")) return "netbanking";
  if (t.includes("upi")) return "upi";
  if (t.includes("wallet")) return "wallet";
  if (t.includes("emi")) return "emi";
  if (t.includes("card") || t === "cc") return "card";
  return "card";
}

export const payuAdapter = {
  instance: (cfg: ProviderConfig) => new PayUAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new PayUAdapter(cfg, http),
};
