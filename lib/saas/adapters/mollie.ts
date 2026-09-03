/**
 * Mollie adapter (EEA+CH+UK) — hosted checkout via Payments API `_links.checkout`.
 *
 * Auth: Bearer API key. Server creates a payment and redirects the browser to
 * Mollie's hosted checkout — card data never touches the HospiOS server (SAQ-A).
 * Confirmation is authoritative only via the signed webhook.
 *
 * Webhook signature: `X-Mollie-Signature: sha256=<hex>` = HMAC-SHA256 (hex) over
 * the RAW request body using the webhook signing secret. @docs:
 * https://docs.mollie.com/reference/webhooks-new
 */
import { PaymentProviderAdapter } from "@/lib/saas/payments/adapter";
import { hmacSha256Hex, matchSignature, defaultHttp, GatewayError, headerMap, readRecord, readString, type HttpTransport } from "./_shared";
import { classifyPaymentError } from "@/lib/saas/payments/errors";
import type {
  PaymentCheckout, PaymentWebhookEvent, ProviderConfig, ProviderCredentials,
  ProviderPaymentStatus, ProviderRefundResult,
} from "@/lib/saas/payments/types";
import type { CreateCheckoutInput, RefundInput, ConnectionTestResult } from "@/lib/saas/payments/adapter";

const API = "https://api.mollie.com/v2";

/** Normalize a HospiOS method to a Mollie method code. */
function mollieMethod(method?: string): string | undefined {
  if (!method) return undefined;
  switch (method) {
    case "card": return "card";
    case "bancontact": return "bancontact";
    case "apple_pay": return "applepay";
    case "bank_transfer": return "banktransfer";
    case "bnpl": return "klarnapaylater";
    case "google_pay": return "googlepay";
    default: return undefined;
  }
}

export class MollieAdapter extends PaymentProviderAdapter {
  readonly providerId = "mollie";
  protected readonly capabilities = [
    "hosted_checkout", "refund", "partial_refund", "recurring",
    "multi_currency", "webhook", "test_mode",
  ] as const;

  constructor(cfg: ProviderConfig, private http: HttpTransport = defaultHttp) {
    super(cfg);
  }

  private bearer(): string {
    const key = this.cfg.credentials.secretKey?.masked ?? "";
    if (!key) throw new GatewayError("Provider \"mollie\" is not configured", 503);
    return `Bearer ${key}`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout> {
    const body: Record<string, unknown> = {
      amount: { currency: input.currency.toUpperCase(), value: minorToMajor(input.amountMinor) },
      description: `Invoice ${input.invoiceId ?? "payment"}`,
      redirectUrl: input.returnUrl,
      webhookUrl: this.cfg.webhookPath,
      metadata: { payment_intent_id: input.intentId, organization_id: input.organizationId },
    };
    const mm = mollieMethod(input.method);
    if (mm) body.method = mm;

    const res = await this.http(`${API}/payments`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Mollie payment failed: ${readString(data.detail) || "unknown"}`, res.status);
    const links = readRecord(data._links);
    const checkout = readRecord(links.checkout);
    const expires = data.expiresAt != null ? new Date(readString(data.expiresAt)).getTime() : null;
    return {
      intentId: input.intentId,
      providerId: this.providerId,
      checkoutUrl: readString(checkout.href),
      clientToken: null,
      providerRef: readString(data.id),
      expiresAtMs: Number.isFinite(expires ?? NaN) ? expires : null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus> {
    const res = await this.http(`${API}/payments/${encodeURIComponent(providerRef)}`, { headers: { Authorization: this.bearer() } });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Mollie status lookup failed (HTTP ${res.status})`, res.status);
    const status = readString(data.status);
    let norm: ProviderPaymentStatus["status"] = "pending";
    if (status === "paid" || status === "authorized") norm = "succeeded";
    else if (status === "failed") norm = "failed";
    else if (status === "canceled" || status === "expired") norm = "cancelled";
    else if (status === "refunded" || status === "partially_refunded") norm = "refunded";
    const amount = readRecord(data.amount);
    const details = readRecord(data.details);
    return {
      providerRef,
      status: norm,
      amountMinor: amount.value != null ? majorToMinor(readString(amount.value)) : null,
      currency: amount.currency != null ? readString(amount.currency).toUpperCase() : null,
      failureReason: status === "failed" ? readString(details.failureReason) || null : null,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent> {
    const h = headerMap(headers);
    const provided = h["x-mollie-signature"];
    if (!provided) throw new GatewayError("Missing X-Mollie-Signature", 400);
    const secret = this.cfg.credentials.webhookSecret?.masked ?? "";
    if (!secret) throw new GatewayError("Provider \"mollie\" webhook secret not configured", 503);
    const signed = provided.startsWith("sha256=") ? provided.slice(7) : provided;
    if (!matchSignature(hmacSha256Hex(secret, rawBody), signed)) throw new GatewayError("Mollie signature mismatch", 400);

    // Next-gen events webhook: payload is `{ id, type, resource, eventId, data }`
    const parsed = parseMollieWebhook(JSON.parse(rawBody) as unknown);
    return {
      providerId: this.providerId,
      eventId: parsed.eventId,
      type: parsed.type,
      providerRef: parsed.providerRef,
      providerPaymentId: parsed.type === "payment.refunded" ? null : parsed.providerRef || null,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      refundAmountMinor: parsed.type === "payment.refunded" ? parsed.amountMinor ?? undefined : undefined,
      method: null,
      raw: parsed.raw,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    if (!input.providerRef) throw new GatewayError("Mollie refund requires a payment id", 400);
    const body: Record<string, unknown> = { description: input.reason ?? "Refund" };
    if (input.amountMinor != null && input.amountMinor !== 0) {
      body.amount = { currency: input.currency.toUpperCase(), value: minorToMajor(input.amountMinor) };
    }
    const res = await this.http(`${API}/payments/${encodeURIComponent(input.providerRef)}/refunds`, {
      method: "POST",
      headers: { Authorization: this.bearer(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = readRecord(await res.json());
    if (!res.ok) throw new GatewayError(`Mollie refund failed: ${readString(data.detail) || "unknown"}`, res.status);
    const amt = readRecord(data.amount);
    return { ok: true, refundedAmountMinor: amt.value ? majorToMinor(readString(amt.value)) : input.amountMinor, providerRefundId: readString(data.id) || null };
  }

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult> {
    const key = credentials.secretKey?.masked ?? "";
    if (!key) return { status: "MISCONFIGURED", error: "Missing Mollie API key" };
    try {
      const res = await this.http(`${API}/methods?limit=1`, { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) return { status: "CONNECTED" };
      return { status: "FAILED", error: `Mollie connection failed (HTTP ${res.status})`, reason: classifyPaymentError(null, { status: res.status }) };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: classifyPaymentError(e) };
    }
  }
}

/** Mollie amounts are major-unit strings ("10.00"). */
function majorToMinor(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function minorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Typed normalization of a Mollie events-webhook payload (untrusted).
 * Accepts both the new `resource`/`data` envelope and a legacy object shape.
 */
function parseMollieWebhook(payload: unknown): {
  eventId: string;
  type: PaymentWebhookEvent["type"];
  providerRef: string;
  amountMinor: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
} {
  const top = readRecord(payload);
  const data = readRecord(top.data);
  const resource = readRecord(data.resource ? data.resource : data);
  const id = readString(data.id) || readString(top.id);
  const eventType = readString(top.type);
  const providerRef = readString(data.id) || id;
  const status = readString(resource.status) || readString(data.status);

  let normType: PaymentWebhookEvent["type"];
  if (eventType.includes("payment.paid") || status === "paid") normType = "payment.succeeded";
  else if (eventType.includes("refund")) normType = "payment.refunded";
  else if (eventType.includes("payment.failed") || status === "failed") normType = "payment.failed";
  else normType = "payment.succeeded";

  const amt = readRecord(resource.amount ? resource.amount : data.amount);
  const amountMinor = amt.value ? majorToMinor(readString(amt.value)) : null;
  return {
    eventId: readString(top.eventId) || `${eventType}-${providerRef}`,
    type: normType,
    providerRef,
    amountMinor,
    currency: amt.currency ? readString(amt.currency).toUpperCase() : null,
    raw: top,
  };
}

export const mollieAdapter = {
  instance: (cfg: ProviderConfig) => new MollieAdapter(cfg),
  newWithTransport: (cfg: ProviderConfig, http: HttpTransport) => new MollieAdapter(cfg, http),
};
