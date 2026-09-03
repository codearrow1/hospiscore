/**
 * Razorpay adapter (integrationStatus: "verify").
 * Webhook signature: HMAC-SHA256 over the raw JSON body, compared against the
 * `X-Razorpay-Signature` header; `X-Razorpay-Event-Id` is the idempotency key.
 * Hosted checkout via Payment Links (payment_link) or Orders API.
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { hmacSha256Hex, matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readString, readNumber, readNestedString, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api.razorpay.com/v1";

export class RazorpayAdapter extends PaymentProviderAdapter {
  readonly providerId = "razorpay";
  protected readonly capabilities = ["hosted_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private auth(): string {
    const key = this.cfg.credentials.publishableKey ?? "";
    const secret = this.cfg.credentials.secretKey?.masked ?? "";
    if (!key || !secret) throw new GatewayError("Provider \"razorpay\" is not configured", 503);
    return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const res = await this.http(`${API}/payment_links`, {
      method: "POST",
      headers: { Authorization: this.auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        accept_partial: false,
        description: `Invoice ${input.invoiceId ?? "payment"}`,
        customer_notify: { notify: false },
        notes: { payment_intent_id: input.intentId, organization_id: input.organizationId },
        // payment method selection left to the hosted page
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Razorpay payment link failed: ${readNestedString(data.error, "description") || "unknown"}`, res.status);
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: readString(data.short_url),
      clientToken: null,
      providerRef: readString(data.id),
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const res = await this.http(`${API}/payment_links/${providerRef}`, { headers: { Authorization: this.auth() } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Razorpay lookup failed (HTTP ${res.status})`, res.status);
    const status = readString(data.status);
    const paid = status === "paid";
    const cancelled = status === "cancelled" || status === "expired";
    return {
      providerRef,
      status: paid ? "succeeded" : cancelled ? "cancelled" : "pending",
      amountMinor: data.amount != null ? readNumber(data.amount) : null,
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      providerPaymentId: data.payment_id != null ? readString(data.payment_id) : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-razorpay-signature"];
    if (!provided) throw new GatewayError("Missing X-Razorpay-Signature", 400);
    const secret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!secret) throw new GatewayError("Provider \"razorpay\" webhook secret not configured", 503);
    const expected = hmacSha256Hex(secret, rawBody);
    if (!matchSignature(expected, provided)) throw new GatewayError("Razorpay signature mismatch", 400);

    const payload = JSON.parse(rawBody) as unknown;
    const top = readRecord(payload);
    const pl = readRecord(top.payload);
    const entity = readRecord(readRecord(pl.payment).entity);
    const paymentLinkEntity = readRecord(readRecord(pl.payment_link).entity);
    let providerRef = paymentLinkEntity.id ? readString(paymentLinkEntity.id) : readString(entity.order_id);
    if (!providerRef) providerRef = readString(entity.order_id) || readString(entity.id);
    const event = readString(top.event);
    const eventId = readString(top.event) || readString(h["x-razorpay-event-id"]);
    const amountMinor = entity.amount != null ? readNumber(entity.amount) : null;
    const status = readString(entity.status) || event;

    let normType: PaymentWebhookEvent["type"];
    if (status === "captured" || event.includes("payment.captured")) normType = "payment.succeeded";
    else if (event.includes("payment.failed") || status === "failed") normType = "payment.failed";
    else if (event.includes("refund") || status === "refunded") normType = "payment.refunded";
    else normType = "payment.succeeded";

    const card = readRecord(entity.card);
    return {
      providerId: this.providerId,
      eventId: eventId || `${top.event}-${readString(entity.id) || providerRef}`,
      type: normType,
      providerRef,
      providerPaymentId: entity.id != null ? readString(entity.id) : null,
      amountMinor,
      currency: entity.currency != null ? readString(entity.currency).toUpperCase() : null,
      refundAmountMinor: status === "refunded" ? amountMinor ?? undefined : undefined,
      method: entity.method != null || card.network != null ? "card" : null,
      raw: top as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const res = await this.http(`${API}/payments/${input.providerRef}/refund`, {
      method: "POST",
      headers: { Authorization: this.auth(), "Content-Type": "application/json" },
      body: input.amountMinor != null ? JSON.stringify({ amount: input.amountMinor }) : undefined,
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Razorpay refund failed: ${readNestedString(data.error, "description") || "unknown"}`, res.status);
    return { ok: true, refundedAmountMinor: data.amount != null ? readNumber(data.amount) ?? input.amountMinor : input.amountMinor, providerRefundId: readString(data.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const key = credentials.publishableKey ?? "";
    const secret = credentials.secretKey?.masked ?? "";
    if (!key || !secret) return { status: "MISCONFIGURED", error: "Missing key/secret pair" };
    try {
      const res = await this.http(`${API}/orders?count=1`, { headers: { Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") } });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Razorpay API error (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

export const razorpayAdapter = {
  instance: (cfg: ProviderConfig) => new RazorpayAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new RazorpayAdapter(cfg, http),
};
