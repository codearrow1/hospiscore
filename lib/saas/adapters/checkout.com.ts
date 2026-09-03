/**
 * Checkout.com adapter (global) — hosted Payment Sessions redirect checkout.
 *
 * Auth: Bearer secret key (server-only). Hosted checkout via Payment Sessions
 * returns a `redirect_url` — the browser is redirected there and card data
 * never touches the HospiOS server (SAQ-A).
 *
 * Webhook signature: HMAC-SHA256 (hex) over the RAW request body, compared to
 * the `Cko-Signature` header. Event `id` is the idempotency key. @docs:
 * https://docs.checkout.com/
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { hmacSha256Hex, matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readArray, readString, readNumber, readBoolean, readNestedString, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api.checkout.com";

export class CheckoutComAdapter extends PaymentProviderAdapter {
  readonly providerId = "checkout.com";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "recurring",
    "authorization", "capture", "multi_currency", "webhook", "test_mode",
  ] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private bearer(): string {
    const secret = this.cfg.credentials.secretKey?.masked ?? "";
    if (!secret) throw new GatewayError("Provider \"checkout.com\" is not configured", 503);
    return `Bearer ${secret}`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const res = await this.http(`${API}/payment-sessions`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: input.intentId,
        amount: input.amountMinor,
        currency: input.currency.toUpperCase(),
        billing: { address: { country: "US" } },
        success_url: input.returnUrl,
        failure_url: input.cancelUrl,
        payment_type: "Regular",
        // capture on settlement by default
        capture: true,
      }),
    });
    const parsed = parseSession(await res.json());
    if (!res.ok) {
      throw new GatewayError(`Checkout.com session failed: ${parsed.rawError}`, res.status);
    }
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: parsed.redirectUrl,
      clientToken: parsed.id || null,
      providerRef: parsed.id,
      expiresAtMs: parsed.expiresAtMs,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const res = await this.http(`${API}/payment-sessions/${providerRef}`, { headers: { Authorization: this.bearer() } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Checkout.com status lookup failed (HTTP ${res.status})`, res.status);
    const approved = readBoolean(data.approved);
    const status = readString(data.status);
    let norm: ProviderPaymentStatus["status"] = "pending";
    if (approved || status === "Authorized" || status === "Captured" || status === "Settled") norm = "succeeded";
    else if (status === "Declined" || status === "Rejected" || status === "Failed") norm = "failed";
    else if (status === "Cancelled" || status === "abandoned") norm = "cancelled";
    const first = readArray(data.payment_response)[0];
    const firstRec = readRecord(first);
    return {
      providerRef,
      status: norm,
      amountMinor: readNumber(data.amount),
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      providerPaymentId: firstRec.id != null ? readString(firstRec.id) : null,
      failureReason: norm === "failed" ? readNestedString(first, "response_summary", "message") || null : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["cko-signature"];
    if (!provided) throw new GatewayError("Missing Cko-Signature", 400);
    const secret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!secret) throw new GatewayError("Provider \"checkout.com\" webhook secret not configured", 503);
    if (!matchSignature(hmacSha256Hex(secret, rawBody), provided)) throw new GatewayError("Checkout.com signature mismatch", 400);

    const payload = JSON.parse(rawBody) as unknown;
    const eventId = readString(readRecord(payload).id);
    const evtType = readString(readRecord(payload).type);
    const data = readRecord(readRecord(payload).data);
    const paymentId = readString(data.payment_id) || readString(data.id);
    // Payment Sessions event uses `data.reference` = our intentId as providerRef.
    let providerRef = readString(data.reference) || readString(data.parent_id);
    if (!providerRef) providerRef = readString(data.id);

    let normType: PaymentWebhookEvent["type"];
    if (evtType.includes("captured") || evtType.includes("payment_captured") || evtType.includes("approved")) normType = "payment.succeeded";
    else if (evtType.includes("refund")) normType = "payment.refunded";
    else if (evtType.includes("declined") || evtType.includes("failed") || evtType.includes("rejected")) normType = "payment.failed";
    else normType = "payment.succeeded";

    const amountMinor = readNumber(data.amount) ?? readNumber(readRecord(payload).amount);
    return {
      providerId: this.providerId,
      eventId: eventId || `${evtType}-${paymentId || providerRef}`,
      type: normType,
      providerRef,
      providerPaymentId: paymentId || null,
      amountMinor,
      currency: data.currency != null ? readString(data.currency).toUpperCase() : null,
      refundAmountMinor: normType === "payment.refunded" && data.amount != null ? readNumber(data.amount) ?? undefined : undefined,
      method: null,
      raw: data,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    if (!this.supports("partial_refund") && !this.supports("refund")) {
      throw new GatewayError("checkout.com does not support refunds", 501);
    }
    const res = await this.http(`${API}/payments/${input.providerRef}/refunds`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Content-Type": "application/json" },
      body: input.amountMinor != null ? JSON.stringify({ amount: input.amountMinor, reference: input.reason ?? undefined }) : undefined,
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Checkout.com refund failed: ${readString(data.message) || "unknown"}`, res.status);
    return { ok: true, refundedAmountMinor: readNumber(data.amount) ?? input.amountMinor, providerRefundId: readString(data.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const secret = credentials.secretKey?.masked ?? "";
    if (!secret) return { status: "MISCONFIGURED", error: "Missing Checkout.com secret key" };
    try {
      const res = await this.http(`${API}/payment-sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reference: "test_conn", amount: 100, currency: "USD", billing: { address: { country: "US" } }, capture: true }),
      });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Checkout.com connection failed (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

/**
 * Typed normalization of a Checkout.com Payment Session response (untrusted).
 * `rawError` is a sanitized error string for failures (prefers the first
 * `error_codes` entry, else `message`) — never a raw provider dump.
 */
function parseSession(data: unknown): {
  id: string;
  redirectUrl: string;
  expiresAtMs: number | null;
  rawError: string;
} {
  const rec = readRecord(data);
  const errorCodes = readArray(rec.error_codes);
  const firstCode = readString(errorCodes[0]);
  const message = readString(rec.message);
  const expires = rec.expires_at != null ? new Date(readString(rec.expires_at)).getTime() : null;
  return {
    id: readString(rec.id),
    redirectUrl: readString(rec.redirect_url),
    expiresAtMs: Number.isFinite(expires ?? NaN) ? expires : null,
    rawError: firstCode || message || "unknown",
  };
}

export const checkoutComAdapter = {
  instance: (cfg: ProviderConfig) => new CheckoutComAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new CheckoutComAdapter(cfg, http),
};
