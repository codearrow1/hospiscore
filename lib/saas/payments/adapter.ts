/**
 * PaymentProviderAdapter — the single interface every gateway implements.
 * Business logic depends ONLY on this; the registry/factory resolves the right
 * adapter at runtime. No financial logic couples to a concrete provider.
 */
import type {
  PaymentCheckout,
  PaymentMethod,
  PaymentWebhookEvent,
  ProviderCapability,
  ProviderConfig,
  ProviderCredentials,
  ProviderPaymentStatus,
  ProviderRefundResult,
} from "./types";

export interface CreateCheckoutInput {
  intentId: string;
  organizationId: string;
  invoiceId?: string | null;
  amountMinor: number;
  currency: string;
  method?: PaymentMethod;
  /** Absolute return/callback URLs the provider should send the buyer back to. */
  returnUrl?: string;
  cancelUrl?: string;
  /** Keyed by a canonical idempotency key so retries reuse one provider intent. */
  idempotencyKey: string;
  /** Masked method label if one is already on file for this org. */
  methodMasked?: string | null;
}

export interface RefundInput {
  providerRef: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export abstract class PaymentProviderAdapter {
  /** Canonical provider key this adapter implements. */
  abstract readonly providerId: string;

  /** Capabilities the provider ACTUALLY exposes (per its documented API). */
  protected abstract readonly capabilities: readonly ProviderCapability[];

  constructor(protected cfg: ProviderConfig) {}

  get config(): ProviderConfig {
    return this.cfg;
  }

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }

  supportsMethod(method: PaymentMethod): boolean {
    return this.cfg.methods.includes(method);
  }

  supportsCurrency(currency: string): boolean {
    return this.cfg.currencies.includes(currency);
  }

  /** Start a payment against the provider. Returns a canonical checkout handle. */
  abstract createCheckout(input: CreateCheckoutInput): Promise<PaymentCheckout>;

  /** Poll/fetch the provider-side status of a payment (reconciliation). */
  abstract getPaymentStatus(providerRef: string): Promise<ProviderPaymentStatus>;

  /** Verify a webhook request and return a normalized, untrusted-safe event. */
  abstract verifyWebhook(rawBody: string, headers: Record<string, string | undefined | string[]>): Promise<PaymentWebhookEvent>;

  /** Full or partial refund. Throws on providers without refund capability. */
  abstract refund(input: RefundInput): Promise<ProviderRefundResult>;

  /** Safe credential validation — a reachable, authorized "hello". */
  abstract testConnection(credentials: ProviderCredentials): Promise<ConnectionTestResult>;
}

/** Result of a safe provider connection test. */
export type ConnectionTestStatus = "CONNECTED" | "FAILED" | "UNSUPPORTED" | "MISCONFIGURED";

export interface ConnectionTestResult {
  status: ConnectionTestStatus;
  /** Sanitized human-readable detail (never a raw provider dump). */
  error?: string;
  /** Optional normalized payment-error reason code. */
  reason?: string;
}

/** Convenience re-export so consumers import one module. */
export type { ProviderConfig, ProviderCredentials };
