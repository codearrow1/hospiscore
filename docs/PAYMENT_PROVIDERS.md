# Payment providers — operator guide (Phase L)

This document covers the provider-agnostic payment platform in HospiOS: which
gateways are wired, what credentials each adapter consumes, how webhooks are
verified, how routing works, and the strict honesty rules that govern provider
readiness. It is the operator-facing companion to the source in
`lib/saas/payments/` and `lib/saas/adapters/`.

> **Golden rule:** a provider is only ever marked **Ready** after a real
> connection test succeeds in a **Test (sandbox)** or **Live** environment. The
> system never fabricates readiness from mere credential entry. Do not enable a
> Live provider until you intend real charges.

---

## 1. Provider status machine

Every configured provider carries one activation status:

| Status | Meaning | Routable? |
| --- | --- | --- |
| `registered` | In the catalog, not usable (no adapter, or not yet configured) | No |
| `verifying` | Wired adapter + credentials entered, awaiting a successful connection test | No |
| `ready` | Successfully verified via a real connection test | **Yes** |
| `verification_failed` | A connection test ran and failed | No |
| `misconfigured` | Enabled but required credentials are missing/invalid | No |
| `disabled` | Explicitly turned off (`enabled = false`) | No |

Transitions:

```
registered ──(credentials entered, wired adapter)──▶ verifying
verifying   ──(successful real connection test)────▶ ready
verifying   ──(connection test failed)─────────────▶ verification_failed
*           ──(required credentials missing)───────▶ misconfigured
*           ──(explicitly disabled)────────────────▶ disabled
```

**Ready is only reachable through a successful provider-level connection
verification** — never by merely entering credentials. An unwired provider is
always `registered` and can never be `ready`.

---

## 2. Wired providers (Phase L priority six + prior)

These have a real adapter (`lib/saas/adapters/*.ts`) and are registered in
`WIRED_PROVIDER_IDS`. The **six priority adapters** completed in Phase L are
marked ★.

| Provider | Adapter | Family | Status in a pristine install |
| --- | --- | --- | --- |
| Stripe | `stripe.ts` | fiat | wired → `verifying` when configured |
| Razorpay | `razorpay.ts` | fiat | wired |
| PayPal | `paypal.ts` | fiat | wired |
| Adyen | `adyen.ts` | fiat | wired |
| Cashfree | `cashfree.ts` | fiat | wired |
| PayU | `payu.ts` | fiat | wired |
| ★ Checkout.com | `checkout.com.ts` | fiat | wired |
| ★ Square | `square.ts` | fiat | wired |
| ★ Mollie | `mollie.ts` | fiat | wired |
| ★ PhonePe PG | `phonepe.ts` | fiat | wired |
| ★ Paytm Payments | `paytm.ts` | fiat | wired |
| ★ Easebuzz | `easebuzz.ts` | fiat | wired |
| Generic (HMAC) | `generic.ts` | fiat | wired (low-level fallback) |

Unwired catalog entries (`braintree`, `authorize.net`, `worldpay`, `ccavenue`,
`coinbase`) remain `registered` and show **no** fake capabilities.

> **Crypto:** Coinbase Commerce was decommissioned (Mar 31 2026); its successor
> is US/SG-only. HospiOS crypto is therefore `REGISTERED` / `NOT AVAILABLE` — it
> is never advertised as integrable.

---

## 3. Credential conventions

Secrets are stored **encrypted at rest** (AES-256-GCM) and are **never**
returned from the API after save — only masked forms (`sk_live_••••1234`). See
“Encryption” below.

Each adapter reads a specific subset from `ProviderCredentials`:

| Provider | Reads | Credential field(s) you must supply in Settings |
| --- | --- | --- |
| Square | `credentials.token` + `extra.location_id` | Access token, App ID (`publishableKey`), Location ID, webhook signature key |
| PhonePe PG | `extra.client_id` + `extra.client_secret` (OAuth) | Client ID, Client Secret, Client version, webhook checksum secret |
| Paytm | `secretKey` (merchant key) + `extra.merchant_id` + `extra.website` | MID, Merchant key, Website (e.g. `WEBSTAGING`) |
| Easebuzz | `extra.merchant_key` (key) + `secretKey` (salt) + `extra.merchant_email` | Merchant key, Salt, Merchant email |
| Stripe / Razorpay / PayPal / Adyen / Checkout.com / Mollie / Cashfree / PayU | standard or per-provider fields | see the Settings credential wizard |

---

## 4. Webhook signature verification

Every wired adapter verifies inbound webhooks using a **constant-time** compare
before reconciling any ledger entry. Signature methods:

| Provider | Method |
| --- | --- |
| Stripe | HMAC-SHA256 (`Stripe-Signature` header, `t=<ts>.<payload>`) |
| Razorpay | HMAC-SHA256 over raw JSON body (`X-Razorpay-Signature`) |
| PayPal | RFC 9421 HTTP message signature (webhook ID) + TLS |
| Adyen | HMAC-SHA256 over the signed data string |
| Cashfree | base64(HMAC-SHA256) over raw body (`x-webhook-signature`) |
| PayU | SHA-512 reverse hash using the Salt |
| Checkout.com | HMAC-SHA256 (hex) over raw body (`Cko-Signature`) |
| Square | base64(HMAC-SHA256(signature_key + notification_url + body)) |
| Mollie | HMAC-SHA256 (hex) over raw body (`X-Mollie-Signature`) |
| PhonePe PG | HMAC-SHA256 over raw body (`X-PHONEPE-CHECKSUM-SIGNATURE`) |
| Paytm | SHA-256 checksum (`head.signature` / `CHECKSUMHASH`) |
| Easebuzz | SHA-512 reverse hash |

> **Paytm note:** the Phase L adapter implements a deterministic, reproducible
> checksum scheme `sha256Hex(merchantKey + JSON.stringify(body))`. Because the
> exact byte convention must be confirmed against the official `PaytmChecksum`
> reference, Paytm is gated `READY` on real sandbox verification — it does not
> claim readiness from contract tests alone.

---

## 5. Routing

Routing is determined by `resolveProvider` in `factory.ts`:

1. Consider only **enabled** providers that are **routable** (Ready / legacy
   `verify`).
2. Filter to candidates supporting the requested currency (and optional method
   / org country).
3. Sort candidates by ascending `priority` (lower = tried first).
4. The configured **default** wins among currency-capable candidates; otherwise
   the lowest-priority candidate is chosen.
5. If nothing is enabled/routable for the currency, checkout fails with a clear
   error (never silently falls through to an unsupported gateway).

### Admin routing editor

The **Settings → Payments → Routing** panel lets operators:

- reorder providers (up/down swaps their priority),
- toggle the single **default** (fallback) provider,
- see each provider’s routability at a glance,
- view **live validation** that mirrors the runtime router (duplicate
  priorities, an un-routable default, multiple defaults, enabled-but-not-ready
  providers, no routable provider, and no-default fallback).

Warnings are derived from the config and always match what the router will
actually do.

---

## 6. Capability matrix

The **capability matrix** (`lib/saas/payments/capabilityMatrix.ts`) is the single
source of truth for what each provider actually supports, sourced from official
provider documentation. It drives:

- `defaultProviderConfig` seeding (countries, currencies, methods, capabilities),
- the admin **Settings → Payments → Capability matrix** view,
- capability discovery (`discoverCapabilities`).

Fields are deliberately honest: `implemented` (a real adapter ships), `wired`
(registered in the WIRED set), `sandbox` (official test credentials exist), and the
documented `countries` / `currencies` / `methods` / `capabilities`. The system never
claims a capability a provider’s documented API does not expose.

---

## 7. Replay & idempotency

- Payment intents are created **server-side** with an idempotency key; an open
  intent for an invoice is reused (duplicate checkout prevention).
- Webhook reconciliation is **idempotent**: replaying an already-settled event
  does not double-settle or double-write the canonical `Payment` ledger row.
- Amounts and currency are **always** derived server-side from the invoice and
  validated against the intent — a mismatched webhook (wrong amount/currency)
  is rejected, never reconciled.

---

## 8. Refunds

Refunds are supported on providers that advertise `refund` / `partial_refund`.
Refund call flows are four-eyes protected by the financial-approvals workflow
(no single operator can submit/approve the same refund). Verify refund amounts
against the settled payment before calling the gateway.

---

## 9. Encryption & environment

Provider secrets are encrypted with **AES-256-GCM**:

- Preferred: set `PAYMENT_ENC_KEY` (an opaque value, e.g. `openssl rand -hex 64`).
- Fallback (demo/self-hosted only): a deterministic PBKDF2 key derived from the
  project data-mirror path. **Not** suitable for production.

Ciphertext format: `v1:<iv-hex>:<tag-hex>:<data-hex>`.

If `PAYMENT_ENC_KEY` is not set, the Settings UI shows a warning and secrets are
stored with the demo fallback key. Set the env var before production.

### Webhook endpoints

Each provider posts webhooks to `POST /api/payments/webhook/<provider-id>`
(e.g. `/api/payments/webhook/stripe`). The full URL (origin + path) is shown in
Settings → Payments → provider Details (copy button provided). Configure the
required events listed there in your gateway dashboard.

---

## 10. Honesty & activation rules (do not fake)

- Providers are registered as `registered` and only move toward `ready` through
  real connection verification. **Never** hand-set a provider to Ready without a
  successful connection test.
- Do not activate **Live** mode until you intend real charges (the UI warns).
- Test (sandbox) configs can reach `ready` only with real sandbox credential
  verification (PASS), not fabricated results.
- The connection-test outcomes are strictly one of: **CONNECTED** (Ready),
  **FAILED**, **MISCONFIGURED** (missing credentials), or **UNSUPPORTED** (no
  safe read-only test exists for that provider).
