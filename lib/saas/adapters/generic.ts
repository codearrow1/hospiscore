/**
 * Generic adapter — a safe default for providers that are registered in the
 * catalog but NOT yet wired. It ONLY verifies webhooks (when the operator has
 * provided an HMAC secret) and never fabricates checkout/refund capabilities.
 * Any attempt to create a checkout or refund through an unwired provider fails
 * explicitly — this is the "do not fake unsupported capabilities" boundary.
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { GatewayError, hmacSha256Hex, matchSignature, headerMap, readRecord, readString, readNumber } from "./_shared";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

export class GenericHmacAdapter extends PaymentProviderAdapter {
  readonly providerId: string;
  protected readonly capabilities = ["webhook"] as const;

  constructor(cfg: ProviderConfig) {
    super(cfg);
    this.providerId = cfg.id;
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<PaymentCheckout> {
    throw new GatewayError(`Provider "${this.providerId}" is registered but not yet wired — no checkout available`, 501);
  }

  async getPaymentStatus(_providerRef: string): Promise<ProviderPaymentStatus> {
    throw new GatewayError(`Provider "${this.providerId}" is registered but not yet wired`, 501);
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-webhook-signature"] ?? h["x-hmac-signature"];
    const secret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!provided || !secret) throw new GatewayError(`Provider "${this.providerId}" webhook signature/secret not configured`, 503);
    const expected = hmacSha256Hex(secret, rawBody);
    if (!matchSignature(expected, provided)) throw new GatewayError("Signature mismatch", 400);
    const data = readRecord(JSON.parse(rawBody) as unknown);
    const id = readString(data.id);
    return {
      providerId: this.providerId,
      eventId: id || `${this.providerId}-${Date.now()}`,
      type: "payment.succeeded",
      providerRef: readString(data.reference) || readString(data.order_id),
      providerPaymentId: readString(data.payment_id) || readString(data.id) || null,
      amountMinor: data.amount != null ? readNumber(data.amount) : null,
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      method: null,
      raw: data as never,
    };
  }

  async refund(_input: RefundInput): Promise<ProviderRefundResult> {
    throw new GatewayError(`Provider "${this.providerId}" refund not implemented`, 501);
  }

  async testConnection(_credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    return { status: "UNSUPPORTED", error: "Provider registered but not wired — no connection test available" };
  }
}

export const genericHmacAdapter = {
  instance: (cfg: ProviderConfig) => new GenericHmacAdapter(cfg),
};
