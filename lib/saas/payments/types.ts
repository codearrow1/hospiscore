/**
 * HospIOS Multi-Provider Payment Platform — Canonical Types (Phase J2).
 *
 * Provider-agnostic, server-only. Customer UI NEVER couples to a specific
 * gateway; every provider is reached through the PaymentProviderFactory.
 *
 * Money is always expressed in integer minor units (cents) with an explicit
 * ISO 4217 `currency`. All financial logic stays server-side; the browser only
 * ever receives a checkoutUrl/hosted-checkout reference and never card data.
 */

/** ISO 4217 currency codes the platform understands in routing. */
export type CurrencyCode = string;

/** Country codes (ISO 3166-1 alpha-2) for regional provider routing. */
export type CountryCode = string;

/** Broad payment-method families used for router matching + capability checks. */
export type PaymentMethod =
  | "card"
  | "upi"
  | "wallet"
  | "bank_transfer"
  | "netbanking"
  | "emi"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "bnpl"
  | "crypto"
  | "manual";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "card", "upi", "wallet", "bank_transfer", "netbanking", "emi",
  "paypal", "apple_pay", "google_pay", "bnpl", "crypto", "manual",
];

/**
 * Named operational capabilities a provider may (or may not) support.
 * NEVER claim a capability a provider does not actually expose — adapters
 * advertise only what their documented API provides, and capability discovery
 * reports the intersection.
 */
export type ProviderCapability =
  | "hosted_checkout" // provider hosts the payment page (redirect/callback)
  | "elements_checkout" // client token + on-page 3DS handled by provider SDK
  | "refund" // full refunds
  | "partial_refund" // partial refunds to an outstanding amount
  | "recurring" // saved method / subscription charges
  | "authorization" // separate authorize + capture lifecycle
  | "capture" // explicit capture of an authorized amount
  | "multi_currency"
  | "webhook" // verifiable server-side webhook confirmation
  | "crypto" // crypto/stablecoin settlement path
  | "test_mode" // sandbox/test credentials supported

export const PROVIDER_CAPABILITIES: readonly ProviderCapability[] = [
  "hosted_checkout", "elements_checkout", "refund", "partial_refund",
  "recurring", "authorization", "capture", "multi_currency", "webhook",
  "crypto", "test_mode",
];

/**
 * Provider activation status machine (Phase K).
 *
 *   registered  ──(credentials entered, wired adapter)──▶ verifying
 *   verifying   ──(successful real connection test)──────▶ ready
 *   verifying   ──(connection test failed)───────────────▶ verification_failed
 *   *           ──(required credentials missing)─────────▶ misconfigured
 *   *           ──(explicitly disabled)──────────────────▶ disabled
 *
 * READY is ONLY reachable through a successful provider-level connection
 * verification — never by merely entering credentials. An unwired provider is
 * always `registered` and can never be `ready`.
 */
export type ProviderIntegrationStatus =
  | "registered" // in the catalog, adapter not wired / not yet usable
  | "verifying" // wired, credentials entered, awaiting a successful connection test
  | "ready" // successfully validated via a real connection test — may process payments
  | "verification_failed" // a connection test ran and failed
  | "disabled" // explicitly turned off (enabled === false)
  | "misconfigured" // wired+enabled but required credentials are missing/invalid
  | "verify" // (legacy) wired per docs; live sandbox confirmation still pending

/** Status values that MUST NOT be routed for payments. */
export const NON_ROUTABLE_STATUSES: readonly ProviderIntegrationStatus[] = [
  "registered",
  "verification_failed",
  "disabled",
  "misconfigured",
];

/** True only when a provider may be routed for a real payment (must be READY). */
export function canRoutePayment(status: ProviderIntegrationStatus | undefined, enabled: boolean): boolean {
  if (!enabled) return false;
  return status === "ready" || status === "verify"; // legacy "verify" kept for compat
}

/** Human-friendly display label for an activation status. */
export function activationStatusLabel(status: ProviderIntegrationStatus | undefined): string {
  switch (status) {
    case "ready": return "Ready";
    case "verifying": return "Verifying";
    case "verification_failed": return "Verification failed";
    case "disabled": return "Disabled";
    case "misconfigured": return "Misconfigured";
    case "verify": return "Wired (needs live test)";
    case "registered": default: return "Registered";
  }
}

/**
 * Opaque, masked secret value. The raw secret is only ever held transiently by
 * a settings write; storage and GET responses expose ONLY a masked form.
 */
export interface MaskedSecret {
  /** Whether a value is currently stored at all. */
  set: boolean;
  /** Masked representation (e.g. "sk_live_••••1234") — never the full secret. */
  masked: string | null;
  /** Last-changed timestamp (ms) to show staleness / drive rotation. */
  updatedAt: number | null;
}

/** Credential bundle a provider adapter needs to talk to the gateway. */
export interface ProviderCredentials {
  /** Public/publishable key (safe to reveal to the SDK as a token issuer). */
  publishableKey?: string;
  /** Opaque secrets — always stored/masked, never exposed raw after save. */
  secretKey?: MaskedSecret;
  /** Provider API token / client id. */
  token?: MaskedSecret;
  /** Webhook signing secret used to verify incoming events. */
  webhookSecret?: MaskedSecret;
  /** Extra provider-specific key/value secrets (client id, merchant id…). */
  extra?: Record<string, MaskedSecret>;
}

/** Currency-specific transaction fee rule (minor units). */
export interface FeeRule {
  percent?: number; // e.g. 2.9 for 2.9%
  fixedMinor?: number; // flat fee in the currency's minor units
  capMinor?: number; // optional max fee in minor units
}

export interface ProviderFeeConfig {
  default?: FeeRule;
  byCurrency?: Record<CurrencyCode, FeeRule>;
}

/** A single routing rule evaluated in priority order. */
export interface RoutingRule {
  id: string;
  countries?: CountryCode[]; // no value = any country
  currencies?: CurrencyCode[]; // no value = any currency
  methods?: PaymentMethod[]; // no value = any method
  providerId: string; // resolved provider to use when the rule matches
}

export interface ProviderConfig {
  /** Canonical provider key (e.g. "stripe", "razorpay"). */
  id: string;
  /** Human display label. */
  label: string;
  /** Integration status (honest capability report). */
  integrationStatus: ProviderIntegrationStatus;
  /** Provider family — fiat vs crypto are modeled, never mixed for settlement. */
  family: "fiat" | "crypto";
  enabled: boolean;
  /** Is this the platform default (highest-priority catch-all)? */
  isDefault: boolean;
  /** Lower priority number = tried first for a matching route (1 = highest). */
  priority: number;
  /** test|live mode. test_mode capability required for "test". */
  mode: "test" | "live";
  countries: CountryCode[];
  currencies: CurrencyCode[];
  methods: PaymentMethod[];
  capabilities: ProviderCapability[];
  fees: ProviderFeeConfig;
  credentials: ProviderCredentials;
  /** Webhook route descriptor to display (and to verify against). */
  webhookPath: string;
  /** Health accounting (driven by reconcile/health sweeps). */
  health: ProviderHealth;
}

/** Provider health — measured, not guessed. */
export interface ProviderHealth {
  healthy: boolean;
  lastCheckedAt: number | null;
  lastError: string | null;
  /** Rolling success window (0..1). */
  successRate: number | null;
  /** Consecutive failures (health sweep increments; recovery resets). */
  consecutiveFailures: number;
}

/** A concrete checkout intent exposed to the caller (canonical, provider-agnostic). */
export interface PaymentCheckout {
  intentId: string;
  providerId: string;
  /** Hosted checkout URL (hosted_checkout) — the browser redirects here. */
  checkoutUrl: string | null;
  /** Client token for elements_checkout (SDK on-page flow). */
  clientToken: string | null;
  /** Provider's own intent/order reference. */
  providerRef: string;
  /** Milliseconds after which the hosted checkout expires. */
  expiresAtMs: number | null;
  amountMinor: number;
  currency: CurrencyCode;
}

/** Canonical result of checking a provider-side payment. */
export interface ProviderPaymentStatus {
  providerRef: string;
  status: "pending" | "succeeded" | "failed" | "cancelled" | "expired" | "refunded";
  amountMinor: number | null; // provider-reported charged amount
  currency: CurrencyCode | null;
  failureReason?: string | null;
  /** Provider-assigned method, normalized when possible. */
  method?: PaymentMethod | null;
  /** Provider-verified payment id (for reconciliation uniqueness). */
  providerPaymentId?: string | null;
}

/** Normalized webhook event handed to the reconciliation layer. */
export interface PaymentWebhookEvent {
  providerId: string;
  /** Provider's globally-unique event id — the idempotency key. */
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "payment.refunded" | "payment.partially_refunded";
  providerRef: string; // maps to a PaymentIntent.providerRef
  providerPaymentId?: string | null;
  /** Provider-reported charged amount in minor units. */
  amountMinor: number | null;
  currency: CurrencyCode | null;
  /** Provider-reported refunded amount (for payment.refunded events). */
  refundAmountMinor?: number;
  method?: PaymentMethod | null;
  /** Raw provider event body (stripped of any nested secrets server-side). */
  raw: Record<string, unknown>;
}

/** Outcome of a refund request to a provider. */
export interface ProviderRefundResult {
  ok: boolean;
  refundedAmountMinor: number;
  providerRefundId?: string | null;
  error?: string;
}

/** Capability discovery for a provider (what it can actually do today). */
export interface CapabilityReport {
  providerId: string;
  integrationStatus: ProviderIntegrationStatus;
  capabilities: ProviderCapability[];
  supportedCurrencies: CurrencyCode[];
  supportedMethods: PaymentMethod[];
  testMode: boolean;
}
