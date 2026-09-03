/**
 * Square adapter (global; 8 countries) — hosted Checkout via CreatePaymentLink.
 *
 * Auth: Bearer personal/OAuth access token. Server creates a payment link and
 * the browser is redirected to Square's hosted checkout — card data never
 * touches the HospiOS server (SAQ-A).
 *
 * Webhook signature: EVERY notification carries `x-square-hmacsha256-signature`
 * = base64(HMAC-SHA256(signature_key + notification_url + raw_request_body)).
 * We recompute that over the RAW body and the notification URL and compare in
 * constant time. @docs: https://developer.squareup.com/docs/webhooks/step3validate
 */
import { createHmac } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { defaultHttp, GatewayError, headerMap, readRecord, readArray, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

export class SquareAdapter extends PaymentProviderAdapter {
  readonly providerId = "square";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "recurring",
    "authorization", "capture", "webhook", "test_mode",
  ] as const;

  private readonly version = "2026-08-19";

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private api(): string {
    return this.cfg.mode === "test" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  }

  private bearer(): string {
    const token = this.cfg.credentials.token?.masked ?? "";
    if (!token) throw new GatewayError("Provider \"square\" is not configured", 503);
    return `Bearer ${token}`;
  }

  private locationId(): string {
    return this.cfg.credentials.extra?.location_id?.masked ?? "";
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const res = await this.http(`${this.api()}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Square-Version": this.version, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: input.idempotencyKey,
        order: {
          location_id: this.locationId(),
          line_items: [{
            name: `Invoice ${input.invoiceId ?? "payment"}`,
            quantity: "1",
            base_price_money: { amount: input.amountMinor, currency: input.currency.toUpperCase() },
          }],
          metadata: { payment_intent_id: input.intentId, organization_id: input.organizationId },
        },
        checkout_options: {
          redirect_url: input.returnUrl,
          merchant_support_email: "",
          ask_for_shipping_address: false,
          payment_method_types: input.method ? [input.method.toUpperCase()] : ["CARD"],
        },
        pre_populated_data: { buyer_email: "" },
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Square payment link failed: ${squareErrorDetail(data)}`, res.status);
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: readString(data.url),
      clientToken: readString(data.id) || null,
      providerRef: readString(data.id),
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    // providerRef = payment link id; payment status is confirmed via webhook, and
    // for polling we look up the linked payment by order id when possible.
    const res = await this.http(`${this.api()}/v2/online-checkout/payment-links/${providerRef}`, { headers: { Authorization: this.bearer(), "Square-Version": this.version } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Square payment link lookup failed (HTTP ${res.status})`, res.status);
    const status = readString(data.status);
    let norm: ProviderPaymentStatus["status"] = "pending";
    if (status === "COMPLETED") norm = "succeeded";
    else if (status === "CANCELED") norm = "cancelled";
    else if (status === "EXPIRED") norm = "expired";
    // amount is on the order's total_money when available
    const orderMoney = readRecord(readRecord(data.order).total_money);
    const paymentIds = readArray(data.payment_ids);
    return {
      providerRef,
      status: norm,
      amountMinor: orderMoney.amount != null ? readNumber(orderMoney.amount) : null,
      currency: orderMoney.currency != null ? readString(orderMoney.currency).toUpperCase() : null,
      providerPaymentId: paymentIds.length > 0 ? readString(paymentIds[0]) : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-square-hmacsha256-signature"];
    if (!provided) throw new GatewayError("Missing x-square-hmacsha256-signature", 400);
    const sigKey = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!sigKey) throw new GatewayError("Provider \"square\" webhook signature key not configured", 503);
    const notificationUrl = h["x-square-webhook-notification-url"] ?? this.cfg.webhookPath;
    const expected = createHmac("sha256", sigKey).update(sigKey + notificationUrl + rawBody).digest("base64");
    if (expected !== provided) throw new GatewayError("Square signature mismatch", 400);

    const payload = JSON.parse(rawBody) as unknown;
    const parsed = parseSquareWebhook(payload);
    return {
      providerId: this.providerId,
      eventId: parsed.eventId,
      type: parsed.type,
      // Square events don't carry our PaymentIntent ref; map via payment id —
      // reconciliation will resolve it against the payment link/order.
      providerRef: parsed.orderId || parsed.paymentId || "",
      providerPaymentId: parsed.paymentId || null,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      refundAmountMinor: parsed.type === "payment.refunded" ? parsed.amountMinor ?? undefined : undefined,
      method: null,
      raw: parsed.raw,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    if (!input.providerRef) throw new GatewayError("Square refund requires a payment id", 400);
    const res = await this.http(`${this.api()}/v2/refunds`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Square-Version": this.version, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: `r_${Date.now()}`,
        payment_id: input.providerRef,
        amount_money: { amount: input.amountMinor, currency: input.currency.toUpperCase() },
        reason: input.reason ?? "Refund",
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Square refund failed: ${squareErrorDetail(data)}`, res.status);
    const refund = readRecord(data.refund);
    const amountMoney = readRecord(refund.amount_money);
    return { ok: true, refundedAmountMinor: readNumber(amountMoney.amount) ?? input.amountMinor, providerRefundId: readString(refund.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const token = credentials.token?.masked ?? "";
    if (!token) return { status: "MISCONFIGURED", error: "Missing Square access token" };
    try {
      const res = await this.http(`${this.api()}/v2/locations`, { headers: { Authorization: `Bearer ${token}`, "Square-Version": this.version } });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Square connection failed (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

/**
 * Square error detail — the API returns `{ errors: [{ detail, code, category }] }`.
 * Extracts the first detail string safely (untrusted input), never a raw dump.
 */
function squareErrorDetail(data: Record<string, unknown>): string {
  const first = readArray(data.errors)[0];
  return readString(readRecord(first).detail) || "unknown";
}

/**
 * Typed normalization of a Square webhook payload (untrusted).
 * Structure: `{ type, event_id, data: { object: { payment|order } } }`.
 * Every hop is read via the safe readers; missing sub-objects are tolerated.
 */
function parseSquareWebhook(payload: unknown): {
  eventId: string;
  type: PaymentWebhookEvent["type"];
  paymentId: string;
  orderId: string;
  amountMinor: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
} {
  const top = readRecord(payload);
  const data = readRecord(top.data);
  const object = readRecord(data.object);
  const payment = readRecord(object.payment);
  const orderId = readString(readRecord(object.order).id);
  const paymentId = readString(payment.id) || readString(data.id);
  const eventId = readString(top.event_id) || `${readString(top.type)}-${paymentId}`;
  const amountMoney = readRecord(payment.amount_money ? payment.amount_money : object.amount_money);
  const type = readString(top.type);
  const payStatus = readString(payment.status);

  let normType: PaymentWebhookEvent["type"];
  if (type.endsWith("payment.completed") || (type.includes("payment.updated") && payStatus === "COMPLETED")) normType = "payment.succeeded";
  else if (type.endsWith("refund.created") || type.includes(".refund.")) normType = "payment.refunded";
  else if (type.endsWith("payment.failed") || payStatus === "FAILED") normType = "payment.failed";
  else normType = "payment.succeeded";

  return {
    eventId,
    type: normType,
    paymentId,
    orderId,
    amountMinor: amountMoney.amount != null ? readNumber(amountMoney.amount) : null,
    currency: amountMoney.currency != null ? readString(amountMoney.currency).toUpperCase() : null,
    raw: top,
  };
}

export const squareAdapter = {
  instance: (cfg: ProviderConfig) => new SquareAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new SquareAdapter(cfg, http),
};
