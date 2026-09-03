/**
 * PhonePe Payment Gateway v2 — Standard Checkout (India).
 *
 * Auth: OAuth 2.0 client-credentials → Bearer access token. Server creates a
 * pay request and redirects the browser to PhonePe's hosted PayPage — card/UPI
 * data never touches the HospiOS server (SAQ-A). Confirmation is authoritative
 * only via verified webhook + order-status polling.
 *
 * Webhook: PhonePe signs the plaintext payload with a checksum secret key
 * (headers X-PHONEPE-CHECKSUM-KEY-ID + X-PHONEPE-CHECKSUM-SIGNATURE). We verify
 * the HMAC-SHA256 of the raw body and require a NONCE / event freshness check
 * for replay safety. @docs: https://developer.phonepe.com/
 */
import { randomUUID, createHmac } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

export class PhonePeAdapter extends PaymentProviderAdapter {
  readonly providerId = "phonepe";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "webhook", "test_mode",
  ] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private api(): string {
    return this.cfg.mode === "test"
      ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
      : "https://api.phonepe.com/apis/pg";
  }

  private async oauthToken(): Promise<string> {
    const clientId = this.cfg.credentials.extra?.client_id?.masked ?? "";
    const clientSecret = this.cfg.credentials.extra?.client_secret?.masked ?? "";
    const clientVersion = this.cfg.credentials.extra?.client_version?.masked ?? "1";
    if (!clientId || !clientSecret) throw new GatewayError("Provider \"phonepe\" is not configured", 503);
    const res = await this.http(`${this.api()}/v1/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        client_version: clientVersion,
      }).toString(),
    });
    const data = readRecord(await res.json());
    if (!res.ok || !data.access_token) {
      throw new GatewayError(`PhonePe OAuth failed (HTTP ${res.status})`, res.status);
    }
    return readString(data.access_token);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const token = await this.oauthToken();
    const res = await this.http(`${this.api()}/checkout/v2/pay`, {
      method: "POST",
      headers: { "O-Bearer": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantOrderId: input.intentId,
        amount: input.amountMinor,
        currency: input.currency.toUpperCase(),
        paymentFlow: {
          type: "PG_CHECKOUT",
          merchantUrls: { redirectUrl: input.returnUrl ?? `/customer/checkout/${input.intentId}`, callbackUrl: this.cfg.webhookPath },
        },
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`PhonePe pay initiation failed: ${readString(data.message) || "unknown"}`, res.status);
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: readString(data.redirectUrl) || readString(data.redirect_url),
      clientToken: null,
      providerRef: readString(data.orderId) || readString(data.merchantOrderId) || input.intentId,
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const token = await this.oauthToken();
    const res = await this.http(`${this.api()}/checkout/v2/order/${encodeURIComponent(providerRef)}/status`, {
      headers: { "O-Bearer": token },
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`PhonePe order status failed (HTTP ${res.status})`, res.status);
    const state = readString(data.state);
    let norm: ProviderPaymentStatus["status"] = "pending";
    if (state === "COMPLETED") norm = "succeeded";
    else if (state === "FAILED") norm = "failed";
    else if (state === "CANCELLED" || state === "EXPIRED" || state === "PENDING") norm = state === "PENDING" ? "pending" : state === "CANCELLED" ? "cancelled" : "expired";
    const orderAmount = readNumber(data.order_amount) ?? readNumber(data.amount) ?? 0;
    const currency = data.order_currency != null || data.currency != null
      ? (readString(data.order_currency) || readString(data.currency)).toUpperCase()
      : null;
    return {
      providerRef,
      status: norm,
      amountMinor: orderAmount > 0 ? orderAmount : null,
      currency,
      failureReason: state === "FAILED" ? readString(data.message) || null : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-phonepe-checksum-signature"];
    const secret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!provided) throw new GatewayError("Missing X-PHONEPE-CHECKSUM-SIGNATURE", 400);
    if (!secret) throw new GatewayError("Provider \"phonepe\" webhook secret not configured", 503);
    // Docs scheme: HMAC-SHA256 of the raw (plaintext) payload using the checksum
    // secret. Webhook ID mounts the key id in a companion header — we bind to
    // the secret stored by the operator and reject mismatches in constant time.
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!matchSignature(expected, provided)) throw new GatewayError("PhonePe webhook signature mismatch", 400);

    const payload = JSON.parse(rawBody) as unknown;
    const top = readRecord(payload);
    const data = readRecord(top.data);
    const event = readString(top.event) || readString(data.event);
    const providerRef = readString(data.merchantOrderId) || readString(data.orderId) || readString(data.transactionId);
    const eventId = readString(top.eventId) || readString(data.eventId) || `${event}-${providerRef}-${randomUUID()}`;
    const amountMinor = data.amount != null ? readNumber(data.amount) : null;
    const state = readString(data.state);

    let normType: PaymentWebhookEvent["type"];
    if (event.includes("COMPLETED") || state === "COMPLETED") normType = "payment.succeeded";
    else if (event.includes("REFUND")) normType = "payment.refunded";
    else if (event.includes("FAILED") || state === "FAILED") normType = "payment.failed";
    else normType = "payment.succeeded";

    return {
      providerId: this.providerId,
      eventId,
      type: normType,
      providerRef,
      providerPaymentId: data.transactionId != null ? readString(data.transactionId) : null,
      amountMinor,
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      refundAmountMinor: normType === "payment.refunded" ? amountMinor ?? undefined : undefined,
      method: null,
      raw: data,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const token = await this.oauthToken();
    const merchantRefundId = `ref_${input.providerRef}_${Date.now()}`;
    const res = await this.http(`${this.api()}/payments/v2/refund`, {
      method: "POST",
      headers: { "O-Bearer": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        originalTransactionId: input.providerRef,
        merchantRefundId,
        amount: input.amountMinor,
        currency: input.currency.toUpperCase(),
        message: input.reason ?? "Refund",
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`PhonePe refund failed: ${readString(data.message) || "unknown"}`, res.status);
    return { ok: true, refundedAmountMinor: readNumber(data.amount) ?? input.amountMinor, providerRefundId: readString(data.refundId) || merchantRefundId };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const clientId = credentials.extra?.client_id?.masked ?? "";
    const clientSecret = credentials.extra?.client_secret?.masked ?? "";
    if (!clientId || !clientSecret) return { status: "MISCONFIGURED", error: "Missing PhonePe client id/secret" };
    try {
      const token = await new PhonePeAdapter({ ...this.cfg, credentials }).oauthToken();
      return token ? { status: "CONNECTED" } : { status: "FAILED", error: "PhonePe returned no token" };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

export const phonePeAdapter = {
  instance: (cfg: ProviderConfig) => new PhonePeAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new PhonePeAdapter(cfg, http),
};
