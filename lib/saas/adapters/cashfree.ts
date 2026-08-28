/**
 * Cashfree adapter (integrationStatus: "verify").
 * Webhook signature: `x-webhook-signature` = base64( HMAC-SHA256(body, secret) )
 * with `x-webhook-id` for idempotency. Hosted checkout via Orders API (v2).
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { defaultHttp, GatewayError, headerMap, hmacSha256Hex, matchSignature, readRecord, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api.cashfree.com";

function computeCashfreeSignature(body: string, secret: string): string {
  return Buffer.from(hmacSha256Hex(secret, body), "hex").toString("base64");
}

export class CashfreeAdapter extends PaymentProviderAdapter {
  readonly providerId = "cashfree";
  protected readonly capabilities = ["hosted_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private creds(): { clientId: string; clientSecret: string; webhookSecret?: string } {
    const clientId = this.cfg.credentials.extra?.client_id?.masked ?? "";
    const clientSecret = this.cfg.credentials.secretKey?.masked ?? "";
    const webhookSecret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!clientId || !clientSecret) throw new GatewayError("Provider \"cashfree\" is not configured", 503);
    return { clientId, clientSecret, webhookSecret };
  }

  private async token(xApiVersion = "2023-08-01"): Promise<string> {
    const { clientId, clientSecret } = this.creds();
    const res = await this.http(`${API}/pgaas/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": xApiVersion,
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
    });
    const data = readRecord(await res.json());
    if (!res.ok || !data.access_token) throw new GatewayError("Cashfree auth failed", res.status);
    return readString(data.access_token);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const token = await this.token();
    const res = await this.http(`${API}/pg/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "x-api-version": "2023-08-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: input.intentId,
        order_amount: input.amountMinor / 100,
        order_currency: input.currency,
        order_note: `Invoice ${input.invoiceId ?? "payment"}`,
        customer_details: { customer_id: input.organizationId },
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("Cashfree order create failed", res.status);
    const sessionId = readString(data.payment_session_id);
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: sessionId ? `${API}/pg/checkout?payment_session_id=${sessionId}` : readString(data.order_link),
      clientToken: data.payment_session_id != null ? sessionId : null,
      providerRef: readString(data.order_id) || input.intentId,
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const token = await this.token();
    const res = await this.http(`${API}/pg/orders/${providerRef}`, { headers: { Authorization: `Bearer ${token}`, "x-api-version": "2023-08-01" } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("Cashfree lookup failed", res.status);
    const status = readString(data.order_status);
    const paid = status === "PAID";
    const failed = status === "FAILED" || status === "CANCELLED";
    return {
      providerRef,
      status: paid ? "succeeded" : failed ? "failed" : "pending",
      amountMinor: data.order_amount != null ? (() => { const v = readNumber(data.order_amount); return v == null || !Number.isFinite(v) ? null : Math.round(v * 100); })() : null,
      currency: data.order_currency != null ? readString(data.order_currency).toUpperCase() : null,
      providerPaymentId: data.cf_payment_id != null ? readString(data.cf_payment_id) : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-webhook-signature"];
    if (!provided) throw new GatewayError("Missing x-webhook-signature", 400);
    const secret = this.creds().webhookSecret;
    if (!secret) throw new GatewayError("Provider \"cashfree\" webhook secret not configured", 503);
    const expected = computeCashfreeSignature(rawBody, secret);
    if (!matchSignature(expected, provided)) throw new GatewayError("Cashfree signature mismatch", 400);

    const top = readRecord(JSON.parse(rawBody) as unknown);
    const order = readRecord(top.order);
    const payment = readRecord(top.payment);
    const status = readString(payment.payment_status);
    const eventData = readRecord(top.data);
    const type = readString(top.type) || readString(eventData.type);
    const isRefund = type.toUpperCase().includes("REFUND");
    const amountMajor = payment.order_amount != null ? readNumber(payment.order_amount) : null;
    const orderAmountMinor = amountMajor != null && Number.isFinite(amountMajor) ? Math.round(amountMajor * 100) : null;

    return {
      providerId: this.providerId,
      eventId: readString(top.id) || readString(h["x-webhook-id"]) || `${type}-${order.order_id}`,
      type: isRefund ? "payment.refunded" : status === "SUCCESS" ? "payment.succeeded" : status === "FAILED" ? "payment.failed" : "payment.succeeded",
      providerRef: readString(order.order_id),
      providerPaymentId: payment.cf_payment_id != null ? readString(payment.cf_payment_id) : null,
      amountMinor: orderAmountMinor,
      currency: payment.order_currency != null ? readString(payment.order_currency).toUpperCase() : null,
      refundAmountMinor: isRefund ? orderAmountMinor ?? undefined : undefined,
      method: typeof payment.payment_method === "string" ? normalizeCashfreeMethod(readString(payment.payment_method)) : null,
      raw: top as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const token = await this.token();
    const res = await this.http(`${API}/pg/orders/${input.providerRef}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "x-api-version": "2023-08-01", "Content-Type": "application/json" },
      body: JSON.stringify({ refund_amount: input.amountMinor / 100, refund_note: input.reason ?? "refund" }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("Cashfree refund failed", res.status);
    return { ok: true, refundedAmountMinor: input.amountMinor, providerRefundId: readString(data.cf_refund_id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const clientId = credentials.extra?.client_id?.masked ?? "";
    const clientSecret = credentials.secretKey?.masked ?? "";
    if (!clientId || !clientSecret) return { status: "MISCONFIGURED", error: "Missing client id/secret" };
    try {
      const res = await this.http(`${API}/pgaas/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-version": "2023-08-01", "x-client-id": clientId, "x-client-secret": clientSecret },
        body: JSON.stringify({ grant_type: "client_credentials" }),
      });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Cashfree auth error (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

export const cashfreeAdapter = {
  instance: (cfg: ProviderConfig) => new CashfreeAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new CashfreeAdapter(cfg, http),
};

function normalizeCashfreeMethod(m: string): PaymentWebhookEvent["method"] {
  const t = m.toLowerCase();
  if (t.includes("upi")) return "upi";
  if (t.includes("netbanking")) return "netbanking";
  if (t.includes("wallet")) return "wallet";
  if (t.includes("emi")) return "emi";
  return "card";
}
