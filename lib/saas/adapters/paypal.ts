/**
 * PayPal adapter (integrationStatus: "verify").
 * Orders V2 API for hosted/approve checkout; webhooks verified per PayPal's
 * signing scheme: fetch the webhook's public certificate and verify the
 * transmitted signature over the raw body. Token auth uses OAuth2
 * client_credentials with (client_id, client_secret).
 */
import { createVerify } from "node:crypto";
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { defaultHttp, GatewayError, headerMap, readRecord, readArray, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api-m.paypal.com";
const SANDBOX = "https://api-m.sandbox.paypal.com";

export class PayPalAdapter extends PaymentProviderAdapter {
  readonly providerId = "paypal";
  protected readonly capabilities = ["hosted_checkout", "refund", "partial_refund", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private base(): string {
    return this.cfg.mode === "test" ? SANDBOX : API;
  }

  private creds(): { clientId: string; secret: string; webhookId?: string | null } {
    const clientId = this.cfg.credentials.publishableKey ?? "";
    const secret = this.cfg.credentials.secretKey?.masked ?? "";
    if (!clientId || !secret) throw new GatewayError("Provider \"paypal\" is not configured", 503);
    return { clientId, secret, webhookId: this.cfg.credentials.extra?.webhook_id?.masked };
  }

  private async token(): Promise<string> {
    const { clientId, secret } = this.creds();
    const res = await this.http(`${this.base()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const data = readRecord(await res.json());
    if (!res.ok || !data.access_token) throw new GatewayError("PayPal auth failed", res.status);
    return readString(data.access_token);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const token = await this.token();
    const res = await this.http(`${this.base()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: input.intentId,
          custom_id: input.intentId,
          amount: { currency_code: input.currency, value: (input.amountMinor / 100).toFixed(2) },
        }],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          user_action: "PAY_NOW",
        },
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("PayPal order create failed", res.status);
    const links = readArray(data.links);
    const approve = links.find((l) => readString(readRecord(l).rel) === "approve");
    const approveHref = approve != null ? readString(readRecord(approve).href) : "";
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: approveHref || null,
      clientToken: null,
      providerRef: readString(data.id),
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const token = await this.token();
    const res = await this.http(`${this.base()}/v2/checkout/orders/${providerRef}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("PayPal lookup failed", res.status);
    const status = readString(data.status);
    let norm: ProviderPaymentStatus["status"] = "pending";
    if (status === "COMPLETED") norm = "succeeded";
    else if (status === "VOIDED" || status === "CANCELLED") norm = "cancelled";
    const pu0 = readRecord(readArray(data.purchase_units)[0]);
    const payments = readRecord(pu0.payments);
    const captures = readRecord(readArray(payments.captures)[0]);
    const amountRef = readRecord(pu0.amount);
    const topAmount = readRecord(data.amount);
    const cur = readString(amountRef.currency_code) || readString(topAmount.currency_code);
    const val = readString(amountRef.value) || readString(topAmount.value);
    return {
      providerRef,
      status: norm,
      amountMinor: val ? (() => { const v = readNumber(val); return v == null || !Number.isFinite(v) ? null : Math.round(v * 100); })() : null,
      currency: cur ? cur.toUpperCase() : null,
      providerPaymentId: captures.id != null ? readString(captures.id) : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const { webhookId } = this.creds();
    if (!webhookId) throw new GatewayError("Provider \"paypal\" webhook id not configured", 503);
    const transmitted = h["paypal-transmission-sig"];
    const certUrl = h["paypal-cert-url"];
    const authAlgo = h["paypal-auth-algo"];
    const transmissionId = h["paypal-transmission-id"];
    const transmissionTime = h["paypal-transmission-time"];
    if (!transmitted || !certUrl || !transmissionId || !transmissionTime) {
      throw new GatewayError("Missing PayPal signature headers", 400);
    }

    const certRes = await this.http(certUrl, {});
    const cert = await certRes.text();
    if (!clickedCertUrlOk(certUrl, cert)) throw new GatewayError("Invalid PayPal cert url", 400);
    const crc = transmissionId + "|" + transmissionTime + "|" + webhookId + "|" + rawBody;
    const verifier = createVerify(authAlgo ?? "SHA256");
    verifier.update(crc);
    const ok = verifier.verify(cert, Buffer.from(transmitted, "base64"));
    if (!ok) throw new GatewayError("PayPal signature mismatch", 400);

    const payload = JSON.parse(rawBody) as unknown;
    const top = readRecord(payload);
    const eventType = readString(top.event_type);
    const resource = readRecord(top.resource);
    const supplementary = readRecord(resource.supplementary_data);
    const related = readRecord(supplementary.related_ids);
    const amountObj = readRecord(resource.amount);
    let normType: PaymentWebhookEvent["type"];
    const abs = readString(resource.status);
    if (eventType.includes("PAYMENT.CAPTURE.REFUNDED") || eventType.includes("PAYMENT.CAPTURE.REVERSED")) normType = "payment.refunded";
    else if (abs === "COMPLETED" || eventType.includes("PAYMENT.CAPTURE.COMPLETED")) normType = "payment.succeeded";
    else if (abs === "DECLINED" || abs === "FAILED") normType = "payment.failed";
    else normType = "payment.succeeded";

    const isRefund = eventType.includes("REFUNDED") || eventType.includes("REVERSED");
    const val = readString(amountObj.value);
    return {
      providerId: this.providerId,
      eventId: readString(top.id) || transmissionId,
      type: normType,
      providerRef: readString(related.order_id) || readString(resource.custom_id) || readString(resource.id),
      providerPaymentId: resource.id != null ? readString(resource.id) : null,
      amountMinor: val ? (() => { const v = readNumber(val); return v == null || !Number.isFinite(v) ? null : Math.round(v * 100); })() : null,
      currency: amountObj.currency_code != null ? readString(amountObj.currency_code).toUpperCase() : null,
      refundAmountMinor: isRefund && val ? (() => { const v = readNumber(val); return v == null || !Number.isFinite(v) ? undefined : Math.round(v * 100); })() : undefined,
      method: "paypal",
      raw: top as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const token = await this.token();
    const res = await this.http(`${this.base()}/v2/payments/captures/${input.providerRef}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: { value: (input.amountMinor / 100).toFixed(2), currency_code: input.currency } }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("PayPal refund failed", res.status);
    return { ok: true, refundedAmountMinor: input.amountMinor, providerRefundId: readString(data.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const clientId = credentials.publishableKey ?? "";
    const secret = credentials.secretKey?.masked ?? "";
    if (!clientId || !secret) return { status: "MISCONFIGURED", error: "Missing client id/secret" };
    try {
      const res = await this.http(`${this.base()}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `PayPal auth error (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

/** Ensure the cert URL is a paypal.com host (prevent SSRF to arbitrary hosts). */
function clickedCertUrlOk(url: string, _cert: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "api-m.paypal.com" || u.hostname === "api-m.sandbox.paypal.com" || u.hostname.endsWith(".paypal.com");
  } catch {
    return false;
  }
}

export const paypalAdapter = {
  instance: (cfg: ProviderConfig) => new PayPalAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new PayPalAdapter(cfg, http),
};
