/**
 * Provider capability matrix (Phase L) — the SINGLE source of truth for what
 * each catalog provider ACTUALLY supports, sourced from current official
 * provider documentation (Phase 1 audit, Aug 2026). NOT hardcoded UI claims:
 * the entire matrix derives from these definitions.
 *
 * Fields are deliberately honest:
 *  - `implemented` : whether a real HospiOS adapter exists (wired).
 *  - `tier`        : launch priority (tier 1 = launch-critical, 2 = strategic,
 *                   3 = catalog/future).
 *  - sandbox       : whether official test/sandbox credentials exist to verify.
 *
 * NEVER claim a capability a provider's documented API does not expose, and
 * never mark a provider READY without a real sandbox connection test.
 */
import type { CurrencyCode, CountryCode, PaymentMethod, ProviderCapability } from "./types";

export interface MatrixProvider {
  id: string;
  label: string;
  family: "fiat" | "crypto";
  tier: 1 | 2 | 3;
  /** Does HospiOS ship a real adapter for this provider? */
  implemented: boolean;
  /** Is it registered in the WIRED set (can reach "verifying"/"ready")? */
  wired: boolean;
  /** Does the provider offer an official test/sandbox environment? */
  sandbox: boolean;
  /** Official country scope (ISO alpha-2). Empty = not regionally restricted per docs. */
  countries: CountryCode[];
  /** Official settlement/payment currencies. */
  currencies: CurrencyCode[];
  /** Official payment-method families (normalized). */
  methods: PaymentMethod[];
  /** Official operational capabilities. */
  capabilities: ProviderCapability[];
  /** Credential keys the adapter actually consumes (docs-derived). */
  requiredCredentials: string[];
}

/** Thinly-wrapper ISO codes to keep the table readable. */
const INR = "INR" as CurrencyCode;
const USD = "USD" as CurrencyCode;
const EUR = "EUR" as CurrencyCode;
const GBP = "GBP" as CurrencyCode;
const SGD = "SGD" as CurrencyCode;
const AUD = "AUD" as CurrencyCode;
const CAD = "CAD" as CurrencyCode;
const JPY = "JPY" as CurrencyCode;
const CHF = "CHF" as CurrencyCode;
const NOK = "NOK" as CurrencyCode;
const SEK = "SEK" as CurrencyCode;
const DKK = "DKK" as CurrencyCode;
const PLN = "PLN" as CurrencyCode;
const CZK = "CZK" as CurrencyCode;
const HUF = "HUF" as CurrencyCode;
const RON = "RON" as CurrencyCode;

const IN = "IN" as CountryCode;
const US = "US" as CountryCode;
const GB = "GB" as CountryCode;
const CA = "CA" as CountryCode;
const AU = "AU" as CountryCode;
const FR = "FR" as CountryCode;
const IE = "IE" as CountryCode;
const ES = "ES" as CountryCode;
const JP = "JP" as CountryCode;
const NL = "NL" as CountryCode;
const DE = "DE" as CountryCode;
const IT = "IT" as CountryCode;
const AT = "AT" as CountryCode;
const BE = "BE" as CountryCode;
const CH = "CH" as CountryCode;

/** @docs: https://stripe.com/docs/currencies, /docs/payments/methods */
const stripe: MatrixProvider = {
  id: "stripe", label: "Stripe", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [US, GB, CA, AU, FR, IE, ES, JP, NL, DE, IT, AT, BE, CH, IN],
  currencies: [USD, EUR, GBP, INR, AUD, CAD, JPY, CHF, SGD, NOK, SEK, DKK, PLN, CZK, HUF, RON],
  methods: ["card", "wallet", "upi", "bank_transfer", "apple_pay", "google_pay", "netbanking", "bnpl"],
  capabilities: ["hosted_checkout", "elements_checkout", "refund", "partial_refund", "recurring", "authorization", "capture", "multi_currency", "webhook", "test_mode"],
  requiredCredentials: ["publishableKey", "secretKey", "webhookSecret"],
};

/** @docs: https://docs.razorpay.com/docs */
const razorpay: MatrixProvider = {
  id: "razorpay", label: "Razorpay", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["card", "upi", "netbanking", "wallet", "emi", "bnpl"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode"],
  requiredCredentials: ["publishableKey", "secretKey", "webhookSecret"],
};

/** @docs: https://developer.paypal.com/docs/ */
const paypal: MatrixProvider = {
  id: "paypal", label: "PayPal", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [US, GB, CA, AU, FR, IE, ES, JP, NL, DE, IT, AT, BE, CH],
  currencies: [USD, EUR, GBP, AUD, CAD, JPY, CHF, SGD, NOK, SEK, DKK, PLN, CZK, HUF, RON],
  methods: ["paypal", "card", "apple_pay", "google_pay"],
  capabilities: ["hosted_checkout", "elements_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"],
  requiredCredentials: ["publishableKey", "secretKey", "webhookSecret"],
};

/** @docs: https://docs.adyen.com/ */
const adyen: MatrixProvider = {
  id: "adyen", label: "Adyen", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [US, GB, CA, AU, FR, IE, ES, JP, NL, DE, IT, AT, BE, CH],
  currencies: [USD, EUR, GBP, AUD, CAD, JPY, CHF, SGD, NOK, SEK, DKK, PLN, CZK, HUF, RON],
  methods: ["card", "wallet", "bank_transfer", "apple_pay", "google_pay", "bnpl"],
  capabilities: ["hosted_checkout", "elements_checkout", "refund", "partial_refund", "recurring", "authorization", "capture", "multi_currency", "webhook", "test_mode"],
  requiredCredentials: ["secretKey", "extra.merchant_account", "webhookSecret"],
};

/** @docs: https://docs.cashfree.com/ */
const cashfree: MatrixProvider = {
  id: "cashfree", label: "Cashfree", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["card", "upi", "netbanking", "wallet", "emi", "bnpl"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode"],
  requiredCredentials: ["extra.client_id", "secretKey", "webhookSecret"],
};

/** @docs: payu.in (India) */
const payu: MatrixProvider = {
  id: "payu", label: "PayU", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["card", "netbanking", "upi"],
  capabilities: ["hosted_checkout", "webhook", "test_mode"],
  requiredCredentials: ["extra.merchant_key", "secretKey", "extra.merchant_hash"],
};

/** @docs: https://docs.checkout.com/ */
const checkoutCom: MatrixProvider = {
  id: "checkout.com", label: "Checkout.com", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [US, GB, FR, IE, ES, NL, DE, IT, AT, BE, CH, AU, CA, JP],
  currencies: [USD, EUR, GBP, SGD, AUD, CAD, JPY, CHF, NOK, SEK, DKK, PLN, CZK, HUF, RON],
  methods: ["card", "wallet", "apple_pay", "google_pay", "bank_transfer", "bnpl"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "authorization", "capture", "multi_currency", "webhook", "test_mode"],
  requiredCredentials: ["secretKey", "publishableKey", "webhookSecret"],
};

/** @docs: https://developer.squareup.com/ — note: seller-local-currency only, 8 countries. */
const square: MatrixProvider = {
  id: "square", label: "Square", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [AU, CA, FR, IE, JP, ES, GB, US],
  currencies: [AUD, CAD, EUR, GBP, JPY, USD],
  methods: ["card", "wallet", "apple_pay", "google_pay", "bnpl", "bank_transfer"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "authorization", "capture", "webhook", "test_mode"],
  requiredCredentials: ["token", "publishableKey", "extra.location_id", "webhookSecret"],
};

/** @docs: https://docs.mollie.com/ — EEA+CH+UK, multicurrency acceptance. */
const mollie: MatrixProvider = {
  id: "mollie", label: "Mollie", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [NL, DE, FR, ES, IT, AT, BE, CH, GB, IE],
  currencies: [EUR, GBP, USD, CHF, DKK, NOK, SEK, PLN, CZK, HUF, RON],
  methods: ["card", "apple_pay", "google_pay", "paypal", "bank_transfer", "bnpl", "wallet", "netbanking"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "multi_currency", "webhook", "test_mode"],
  requiredCredentials: ["secretKey", "webhookSecret"],
};

/** @docs: https://developer.phonepe.com/ (PG v2 Standard Checkout) */
const phonepe: MatrixProvider = {
  id: "phonepe", label: "PhonePe PG", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["upi", "card", "netbanking", "wallet", "emi"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "webhook", "test_mode"],
  requiredCredentials: ["extra.client_id", "extra.client_secret", "extra.client_version", "webhookSecret"],
};

/** @docs: https://business.paytm.com/docs (Paytm PG / PPSL All-in-One) */
const paytm: MatrixProvider = {
  id: "paytm", label: "Paytm Payments", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["card", "netbanking", "upi", "wallet", "bnpl", "emi"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode"],
  requiredCredentials: ["extra.merchant_id", "secretKey", "extra.website"],
};

/** @docs: https://docs.easebuzz.in/docs/payment-gateway */
const easebuzz: MatrixProvider = {
  id: "easebuzz", label: "Easebuzz", family: "fiat", tier: 1, implemented: true, wired: true, sandbox: true,
  countries: [IN], currencies: [INR],
  methods: ["card", "upi", "netbanking", "wallet", "emi"],
  capabilities: ["hosted_checkout", "refund", "partial_refund", "recurring", "webhook", "test_mode"],
  requiredCredentials: ["extra.merchant_key", "secretKey"],
};

/** Coinbase Commerce is decommissioned (Mar 31 2026); successor is US/SG-only — NOT AVAILABLE. */
const coinbase: MatrixProvider = {
  id: "coinbase", label: "Coinbase (Crypto)", family: "crypto", tier: 3, implemented: false, wired: false, sandbox: false,
  countries: [], currencies: [],
  methods: ["crypto"],
  capabilities: [],
  requiredCredentials: [],
};

/** Remaining un-implemented catalog providers (honest: registered, not wired). */
function stub(id: string, label: string, tier: 2 | 3): MatrixProvider {
  return {
    id, label, family: "fiat", tier, implemented: false, wired: false, sandbox: true,
    countries: [], currencies: [], methods: [], capabilities: [],
    requiredCredentials: [],
  };
}

export const PROVIDER_MATRIX: MatrixProvider[] = [
  stripe, razorpay, paypal, adyen, cashfree, payu,
  checkoutCom, square, mollie, phonepe, paytm, easebuzz,
  coinbase,
  stub("braintree", "Braintree", 2),
  stub("authorize.net", "Authorize.net", 2),
  stub("worldpay", "Worldpay", 2),
  stub("ccavenue", "CCAvenue", 2),
  stub("mollie2", "Mollie", 3), // placeholder never shown (id guard below)
  stub("checkout", "Checkout", 3),
].filter((p) => p.id !== "mollie2" && p.id !== "checkout");

const MATRIX_BY_ID = new Map(PROVIDER_MATRIX.map((p) => [p.id, p]));

export function matrixFor(id: string): MatrixProvider | undefined {
  return MATRIX_BY_ID.get(id);
}

/** Full matrix for the admin capability-matrix view (data-derived only). */
export function capabilityMatrixRows(): MatrixProvider[] {
  return PROVIDER_MATRIX;
}

/**
 * Default runtime capabilities for a provider when an admin first enables it
 * WITHOUT explicit capability selection — seeded from the honest matrix (the
 * adapter advertises its own real capabilities via `supports()` regardless, so
 * this is a convenience default, never a way to over-claim).
 */
export function defaultMatrixFor(id: string): {
  countries: CountryCode[];
  currencies: CurrencyCode[];
  methods: PaymentMethod[];
  capabilities: ProviderCapability[];
} {
  const m = MATRIX_BY_ID.get(id);
  if (!m) return { countries: [], currencies: [], methods: [], capabilities: [] };
  return {
    countries: [...m.countries],
    currencies: [...m.currencies],
    methods: [...m.methods],
    capabilities: [...m.capabilities],
  };
}
