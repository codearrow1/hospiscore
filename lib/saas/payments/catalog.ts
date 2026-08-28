/**
 * Provider catalog metadata (Phase K) — drives the dynamic credential wizard
 * and the webhook configuration surface. This is pure configuration: it tells
 * the UI WHICH credential fields a provider needs (never any values) and which
 * webhook events/signature each provider uses. Capabilities/fields shown are
 * derived from the real wired adapters — never fabricated.
 */
export interface CredentialField {
  /** Stable key. Known keys: publishableKey, secretKey, token, webhookSecret, or an `extra.<key>`. */
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  inputType?: "password" | "text";
}

export interface WebhookMeta {
  description: string;
  signatureMethod: string;
  events: string[];
}

export interface ProviderMeta {
  id: string;
  label: string;
  family: "fiat" | "crypto";
  wired: boolean;
  credentialFields: CredentialField[];
  webhook?: WebhookMeta;
}

const STD = (prefix: string) =>
  [
    { key: "publishableKey", label: "Public / publishable key", placeholder: `pk_${prefix}…`, required: true },
    { key: "secretKey", label: "Secret key", placeholder: `sk_${prefix}…`, required: true, inputType: "password" },
    { key: "webhookSecret", label: "Webhook signing secret", placeholder: `whsec_${prefix}…`, required: true, inputType: "password" },
  ] as CredentialField[];

export const PROVIDER_META: ProviderMeta[] = [
  {
    id: "stripe", label: "Stripe", family: "fiat", wired: true, credentialFields: STD("live"),
    webhook: {
      description: "Send checkout.session.completed (and charge.refunded for refunds) to the endpoint.",
      signatureMethod: "HMAC-SHA256 (Stripe-Signature header, t=<ts>.<payload>)",
      events: ["checkout.session.completed", "charge.refunded"],
    },
  },
  {
    id: "razorpay", label: "Razorpay", family: "fiat", wired: true,
    credentialFields: [
      { key: "publishableKey", label: "Key ID", placeholder: "rzp_…", required: true },
      { key: "secretKey", label: "Key Secret", placeholder: "rzp_test_…", required: true, inputType: "password" },
      { key: "webhookSecret", label: "Webhook secret", placeholder: "rzp_whsec…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Enable payment.captured and refund.processed webhooks.",
      signatureMethod: "HMAC-SHA256 over the raw JSON body (X-Razorpay-Signature)",
      events: ["payment.captured", "refund.processed"],
    },
  },
  {
    id: "paypal", label: "PayPal", family: "fiat", wired: true,
    credentialFields: [
      { key: "publishableKey", label: "Client ID", placeholder: "A…", required: true },
      { key: "secretKey", label: "Client Secret", placeholder: "E…", required: true, inputType: "password" },
      { key: "webhookSecret", label: "Webhook ID (verify secret)", placeholder: "WH-…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "PayPal verifies via webhook ID; subscribe to CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED / PAYMENT.CAPTURE.REFUNDED.",
      signatureMethod: "RFC 9421 HTTP message signature (webhook ID) + TLS",
      events: ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED"],
    },
  },
  {
    id: "adyen", label: "Adyen", family: "fiat", wired: true,
    credentialFields: [
      { key: "secretKey", label: "API key", placeholder: "AQE…", required: true, inputType: "password" },
      { key: "extra.merchant_account", label: "Merchant account code", placeholder: "YourAccountECOM", required: true },
      { key: "webhookSecret", label: "Webhook HMAC key", placeholder: "your-adyen-hmac", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Configure a Standard webhook with AUTHORISATION (and REFUND) events; HMAC key must match.",
      signatureMethod: "HMAC-SHA256 over the Adyen signed data string",
      events: ["AUTHORISATION", "REFUND"],
    },
  },
  {
    id: "cashfree", label: "Cashfree", family: "fiat", wired: true,
    credentialFields: [
      { key: "extra.client_id", label: "Client ID", placeholder: "CF…", required: true },
      { key: "secretKey", label: "Client Secret", placeholder: "CF_SECRET…", required: true, inputType: "password" },
      { key: "webhookSecret", label: "Webhook secret", placeholder: "cf_whsec…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Enable PAYMENT_SUCCESS_WEBHOOK and PAYMENT_FAILED_WEBHOOK.",
      signatureMethod: "base64(HMAC-SHA256) over the raw JSON body (x-webhook-signature)",
      events: ["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK"],
    },
  },
  {
    id: "payu", label: "PayU", family: "fiat", wired: true,
    credentialFields: [
      { key: "extra.merchant_key", label: "Merchant Key", placeholder: "gtKFFx", required: true },
      { key: "secretKey", label: "Salt", placeholder: "eCwWELxi", required: true, inputType: "password" },
      { key: "extra.merchant_hash", label: "Hash algorithm override", placeholder: "SHA-512 (default)", required: false },
    ],
    webhook: {
      description: "PayU calls back the endpoint with status=success on settlement. No separate webhook secret — the Salt is used for the reverse-hash.",
      signatureMethod: "SHA-512 reverse hash using the Salt",
      events: ["settlement_success"],
    },
  },
  {
    id: "checkout.com", label: "Checkout.com", family: "fiat", wired: true,
    credentialFields: [
      { key: "secretKey", label: "Secret key", placeholder: "sk_…", required: true, inputType: "password" },
      { key: "publishableKey", label: "Public / publishable key", placeholder: "pk_…", required: true },
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_ck_…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Send payment_captured / payment_refunded events; Cko-Signature HMAC over the raw payload.",
      signatureMethod: "HMAC-SHA256 (hex) over the raw body (Cko-Signature header)",
      events: ["payment_captured", "payment_refunded"],
    },
  },
  {
    id: "square", label: "Square", family: "fiat", wired: true,
    credentialFields: [
      { key: "token", label: "Access token", placeholder: "EAAA…", required: true, inputType: "password" },
      { key: "publishableKey", label: "Application ID", placeholder: "sq0idp-…", required: true },
      { key: "extra.location_id", label: "Location ID", placeholder: "L…", required: true },
      { key: "webhookSecret", label: "Webhook signature key", placeholder: "sq0c-…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Subscribe to payment.completed / refund.created; x-square-hmacsha256-signature over signature_key+notification_url+body.",
      signatureMethod: "base64(HMAC-SHA256(signature_key + notification_url + raw body))",
      events: ["payment.completed", "payment.updated", "refund.created"],
    },
  },
  {
    id: "mollie", label: "Mollie", family: "fiat", wired: true,
    credentialFields: [
      { key: "secretKey", label: "API key (test or live)", placeholder: "test_… / live_…", required: true, inputType: "password" },
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_ml_…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Send payment.paid / payment.refund.* inner events; X-Mollie-Signature sha256=… over the raw payload.",
      signatureMethod: "HMAC-SHA256 (hex) over the raw body (X-Mollie-Signature)",
      events: ["payment.paid", "payment.failed", "refund.completed"],
    },
  },
  {
    id: "phonepe", label: "PhonePe Payment Gateway", family: "fiat", wired: true,
    credentialFields: [
      { key: "extra.client_id", label: "Client ID", placeholder: "…", required: true },
      { key: "extra.client_secret", label: "Client Secret", placeholder: "…", required: true, inputType: "password" },
      { key: "extra.client_version", label: "Client version", placeholder: "1", required: true },
      { key: "webhookSecret", label: "Webhook checksum secret", placeholder: "…", required: true, inputType: "password" },
    ],
    webhook: {
      description: "Send checkout-order-completed/failed events; X-PHONEPE-CHECKSUM-SIGNATURE HMAC over the plaintext payload.",
      signatureMethod: "HMAC-SHA256 over the raw body (X-PHONEPE-CHECKSUM-SIGNATURE)",
      events: ["CHECKOUT_ORDER_COMPLETED", "CHECKOUT_ORDER_FAILED", "PG_REFUND_*"],
    },
  },
  {
    id: "paytm", label: "Paytm Payments", family: "fiat", wired: true,
    credentialFields: [
      { key: "extra.merchant_id", label: "MID (merchant id)", placeholder: "…", required: true },
      { key: "secretKey", label: "Merchant key", placeholder: "…", required: true, inputType: "password" },
      { key: "extra.website", label: "Website name", placeholder: "WEBSTAGING", required: false },
    ],
    webhook: {
      description: "Paytm posts a checksum-signed callback; confirm final state via Transaction Status API.",
      signatureMethod: "SHA-256 checksum (head.signature / CHECKSUMHASH)",
      events: ["TXN_SUCCESS", "TXN_FAILURE"],
    },
  },
  {
    id: "easebuzz", label: "Easebuzz", family: "fiat", wired: true,
    credentialFields: [
      { key: "extra.merchant_key", label: "Merchant key", placeholder: "…", required: true },
      { key: "secretKey", label: "Salt", placeholder: "…", required: true, inputType: "password" },
      { key: "extra.merchant_email", label: "Merchant account email", placeholder: "…@…", required: false },
    ],
    webhook: {
      description: "Easebuzz posts a SHA-512 reverse-hash callback with status; verify before reconciling.",
      signatureMethod: "SHA-512 reverse hash (salt|status|udf10..udf1|email|firstname|productinfo|amount|txnid|key)",
      events: ["transaction_success", "transaction_failed", "refund_processed"],
    },
  },
];

/** Providers registered in the catalog but not yet wired to an adapter. */
export const UNWIRED_META: ProviderMeta[] = [
  { id: "braintree", label: "Braintree", family: "fiat", wired: false, credentialFields: STD("br") },
  { id: "authorize.net", label: "Authorize.net", family: "fiat", wired: false, credentialFields: STD("an") },
  { id: "worldpay", label: "Worldpay", family: "fiat", wired: false, credentialFields: STD("wp") },
  { id: "ccavenue", label: "CCAvenue", family: "fiat", wired: false, credentialFields: STD("cc") },
  { id: "coinbase", label: "Coinbase (Crypto)", family: "crypto", wired: false, credentialFields: STD("coinbase") },
];

const META_BY_ID = new Map<string, ProviderMeta>(
  [...PROVIDER_META, ...UNWIRED_META].map((m) => [m.id, m]),
);

export function providerMeta(id: string): ProviderMeta | undefined {
  return META_BY_ID.get(id);
}

/** All catalog meta (wired + unwired) for the admin catalog/registry UI. */
export function allProviderMeta(): ProviderMeta[] {
  return [...PROVIDER_META, ...UNWIRED_META];
}
