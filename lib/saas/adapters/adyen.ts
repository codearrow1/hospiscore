/**
 * Adyen adapter (integrationStatus: "verify").
 * Webhook HMAC per Adyen docs: HMAC-SHA256 (hex) over the concatenation
 *   `normalisedAmount:currency:merchantAccount:merchantReference:originalReference?:pspReference:eventCode:success`
 * where normalisedAmount is the amount in decimal units (e.g. "1000.00").
 * Checkout/orders via the /v68/sessions or /checkout API (hosted).
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { defaultHttp, GatewayError, hmacSha256Hex, matchSignature, readRecord, readArray, readString, readNumber, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

/** Adyen normalises the minor amount to a two-decimal string for HMAC. */
function normalise(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export class AdyenAdapter extends PaymentProviderAdapter {
  readonly providerId = "adyen";
  protected readonly capabilities = ["hosted_checkout", "elements_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private creds(): { apiKey: string; merchantAccount: string; hmac?: string } {
    const apiKey = this.cfg.credentials.secretKey?.masked ?? "";
    const merchantAccount = this.cfg.credentials.extra?.merchant_account?.masked ?? "";
    const hmac = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!apiKey || !merchantAccount) throw new GatewayError("Provider \"adyen\" is not configured", 503);
    return { apiKey, merchantAccount, hmac };
  }

  private base(): string {
    // test mode -> test env; live base else https://checkout-live.adyen.com
    return this.cfg.mode === "test" ? "https://checkout-test.adyen.com" : "https://checkout-live.adyen.com";
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const { apiKey, merchantAccount } = this.creds();
    const res = await this.http(`${this.base()}/v68/sessions`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantAccount,
        reference: input.intentId,
        amount: { value: input.amountMinor, currency: input.currency },
        returnUrl: input.returnUrl,
        countryCode: input.method === "upi" ? "IN" : undefined,
        shopperInteraction: "Ecommerce",
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("Adyen session create failed", res.status);
    const sessionData = Buffer.from(JSON.stringify({
      id: data.id,
      sessionData: data.sessionData,
    })).toString("base64");
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: `${this.base()}/v68/sessions?id=${sessionData}`,
      clientToken: readString(data.sessionData) || null,
      providerRef: readString(data.id),
      expiresAtMs: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    // Adyen requires checks on payment result — minimal look-up path.
    return { providerRef, status: "pending", amountMinor: null, currency: null };
  }

  async verifyWebhook(rawBody: string, _headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const { hmac } = this.creds();
    if (!hmac) throw new GatewayError("Provider \"adyen\" HMAC key not configured", 503);
    const payload = JSON.parse(rawBody) as unknown;
    const top = readRecord(payload);
    const items = readArray(top.notificationItems);
    if (items.length !== 1) throw new GatewayError("Adyen expects exactly one NotificationRequestItem", 400);
    const item = readRecord(readRecord(items[0]).NotificationRequestItem);

    const amount = readRecord(item.amount);
    const amtValue = readNumber(amount.value) ?? 0;
    const currency = readString(amount.currency) || "USD";
    const merchantAccount = readString(item.merchantAccountCode);
    const merchantReference = readString(item.merchantReference);
    const originalReference = item.originalReference != null ? readString(item.originalReference) : "";
    const pspReference = readString(item.pspReference);
    const eventCode = readString(item.eventCode);
    const success = (readString(item.success) || "true").toLowerCase();

    const signedParts = [
      normalise(amtValue),
      currency,
      merchantAccount,
      merchantReference,
    ];
    if (originalReference) signedParts.push(originalReference);
    signedParts.push(pspReference, eventCode, success);
    const signedString = signedParts.join(":") + ":";
    const expected = hmacSha256Hex(hmac, signedString);

    const additionalData = readRecord(item.additionalData);
    const sigArr = readArray(additionalData.hmacSignature);
    const signatureStr = sigArr.length > 0 ? readString(sigArr[0]) : readString(additionalData.hmacSignature);
    if (!matchSignature(expected, signatureStr)) throw new GatewayError("Adyen HMAC mismatch", 400);

    const refunded = eventCode === "REFUND" || eventCode === "REFUNDED_REVERSED";
    const failedEvent = eventCode === "REVIEW_NEEDED" || eventCode === "REFUSED" || eventCode === "CANCELLED" || eventCode === "EXPIRED";
    const cancelled = eventCode === "CANCELLED" || eventCode === "EXPIRED";
    let normType: PaymentWebhookEvent["type"];
    if (refunded) normType = "payment.refunded";
    else if (failedEvent) normType = cancelled ? "payment.failed" : "payment.failed";
    else normType = "payment.succeeded";

    return {
      providerId: this.providerId,
      eventId: `${eventCode}-${pspReference}-${success}`,
      type: normType,
      providerRef: merchantReference || pspReference,
      providerPaymentId: pspReference || null,
      amountMinor: amtValue,
      currency,
      refundAmountMinor: refunded ? amtValue : undefined,
      method: eventCode === "PAYOUT" ? "bank_transfer" : "card",
      raw: top as never,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const { apiKey, merchantAccount } = this.creds();
    const res = await this.http(`${this.base()}/v68/payments/${input.providerRef}/refunds`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantAccount,
        amount: { value: input.amountMinor, currency: input.currency },
        reference: "refund-" + input.providerRef,
      }),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError("Adyen refund failed", res.status);
    return { ok: true, refundedAmountMinor: input.amountMinor, providerRefundId: readString(data.pspReference) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const apiKey = credentials.secretKey?.masked ?? "";
    if (!apiKey) return { status: "MISCONFIGURED", error: "Missing API key" };
    try {
      const res = await this.http(`${this.base()}/v68/paymentMethods`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ merchantAccount: credentials.extra?.merchant_account?.masked ?? "" }),
      });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Adyen API error (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

export const adyenAdapter = {
  instance: (cfg: ProviderConfig) => new AdyenAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new AdyenAdapter(cfg, http),
};
