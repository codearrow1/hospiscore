/**
 * Stripe adapter (integrationStatus: "verify" — request shapes + webhook
 * signature per official docs; confirm against a live/sandbox account).
 *
 * Webhook verification (Stripe-Signature header): HMAC-SHA256 over
 * `t=<timestamp>.<payload>` using the account's webhook signing secret.
 * Checkout: creates a Checkout Session → hosted_checkout URL.
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { hmacSha256Hex, matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readArray, readString, readNumber, readNestedString, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api.stripe.com/v1";

export class StripeAdapter extends PaymentProviderAdapter {
  readonly providerId = "stripe";
  protected readonly capabilities = ["hosted_checkout", "elements_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private creds(): ProviderCredentials {
    return this.cfg.credentials;
  }

  private authHeader(): string {
    const secret = this.creds().secretKey?.masked ?? "";
    if (!secret) throw new GatewayError(`Provider "${this.providerId}" is not configured (missing secret key)`, 503);
    return `Bearer ${secret}`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][unit_amount]": String(input.amountMinor),
      "line_items[0][price_data][product_data][name]": `Invoice ${input.invoiceId ?? "payment"}`,
      "line_items[0][quantity]": "1",
      "metadata[payment_intent_id]": input.intentId,
      "metadata[organization_id]": input.organizationId,
      "idempotency_key": input.idempotencyKey,
    });
    if (input.returnUrl) body.set("success_url", input.returnUrl);
    if (input.cancelUrl) body.set("cancel_url", input.cancelUrl);
    if (input.methodMasked) body.set("metadata[method_masked]", input.methodMasked);

    const res = await this.http(`${API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: body.toString(),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Stripe checkout failed: ${readNestedString(data.error, "message") || "unknown"}`, res.status);
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: readString(data.url),
      clientToken: null,
      providerRef: readString(data.id),
      expiresAtMs: data.expires_at != null ? readNumber(data.expires_at)! * 1000 : null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const res = await this.http(`${API}/checkout/sessions/${providerRef}`, { headers: { Authorization: this.authHeader() } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Stripe lookup failed: ${readNestedString(data.error, "message") || "unknown"}`, res.status);
    const status = readString(data.payment_status);
    return {
      providerRef,
      status: status === "paid" ? "succeeded" : status === "unpaid" ? "pending" : "pending",
      amountMinor: data.amount_total != null ? readNumber(data.amount_total) : null,
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      providerPaymentId: data.payment_intent != null ? readString(data.payment_intent) : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const sig = h["stripe-signature"];
    if (!sig) throw new GatewayError("Missing Stripe-Signature header", 400);
    const webhookSecret = this.creds().webhookSecret?.masked ?? "";
    if (!webhookSecret) throw new GatewayError(`Provider "${this.providerId}" webhook secret not configured`, 503);

    // Timestamp tolerance for replay safety (5 min skew).
    const parts = sig.split(",").map((p) => p.trim());
    let ts = "";
    let provided = "";
    for (const p of parts) {
      if (p.startsWith("t=")) ts = p.slice(2);
      else if (p.startsWith("v1=")) provided = p.slice(3);
    }
    if (!ts || !provided) throw new GatewayError("Malformed Stripe-Signature", 400);
    const parsed = Number(ts);
    if (!Number.isFinite(parsed) || Math.abs(Date.now() / 1000 - parsed) > 300) {
      throw new GatewayError("Stripe event timestamp out of window (replay?)", 400);
    }
    const expected = hmacSha256Hex(webhookSecret, `${ts}.${rawBody}`);
    if (!matchSignature(expected, provided)) {
      throw new GatewayError("Stripe signature mismatch", 400);
    }

    const payload = JSON.parse(rawBody) as unknown;
    const top = readRecord(payload);
    const type = readString(top.type);
    const obj = readRecord(readRecord(top.data).object);
    const eventId = readString(top.id);
    const amountMinor = obj.amount_total != null ? readNumber(obj.amount_total) : obj.amount != null ? readNumber(obj.amount) : null;
    const providerRef = readString(obj.id) || readString(obj.payment_intent);
    const ptypes = readArray(obj.payment_method_types);
    const method = readString(ptypes[0]) || readString(obj.payment_method_type);

    let normType: PaymentWebhookEvent["type"];
    if (type === "checkout.session.completed" || type === "payment_intent.succeeded" || type === "charge.succeeded") normType = "payment.succeeded";
    else if (type === "payment_intent.payment_failed" || type === "charge.failed") normType = "payment.failed";
    else if (type === "charge.refunded") normType = "payment.refunded";
    else normType = "payment.succeeded"; // ignore other types at reconcile layer via status

    return {
      providerId: this.providerId,
      eventId,
      type: normType,
      providerRef,
      providerPaymentId: obj.payment_intent != null ? readString(obj.payment_intent) : obj.id != null ? readString(obj.id) : null,
      amountMinor,
      currency: obj.currency != null ? readString(obj.currency).toUpperCase() : null,
      refundAmountMinor: obj.amount_refunded != null ? readNumber(obj.amount_refunded) ?? undefined : undefined,
      method: normalizeStripeMethod(method),
      raw: top as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const body = new URLSearchParams({
      payment_intent: input.providerRef,
      amount: String(input.amountMinor),
    });
    if (input.reason) body.set("reason", input.reason);
    const res = await this.http(`${API}/refunds`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Stripe refund failed: ${readNestedString(data.error, "message") || "unknown"}`, res.status);
    return { ok: true, refundedAmountMinor: data.amount != null ? readNumber(data.amount) ?? input.amountMinor : input.amountMinor, providerRefundId: readString(data.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const secret = credentials.secretKey?.masked ?? "";
    if (!secret) return { status: "MISCONFIGURED", error: "Missing secret key" };
    try {
      const res = await this.http(`${API}/balance`, { headers: { Authorization: `Bearer ${secret}` } });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Stripe API error (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

function normalizeStripeMethod(m: string): PaymentWebhookEvent["method"] {
  if (m.includes("card")) return "card";
  if (m.includes("upi")) return "upi";
  if (m.includes("wallet")) return "wallet";
  if (m.includes("apple_pay")) return "apple_pay";
  if (m.includes("google_pay")) return "google_pay";
  if (m === "paypal") return "paypal";
  if (m.includes("bank")) return "bank_transfer";
  return m ? (m as PaymentWebhookEvent["method"]) : null;
}

/** Binds a config to an instance at factory time. */
export const stripeAdapter = {
  instance: (cfg: ProviderConfig) => new StripeAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new StripeAdapter(cfg, http),
};
