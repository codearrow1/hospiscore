# PAYMENT PRODUCTION READINESS — HospiOS SaaS Management App

**Release:** `9eefac5` · Phase 8 audit. **No live provider is activated** — by design and this
phase does not change that. Provider neutrality is the correct launch posture.

## Architecture guarantees (verified repo-side)
- **Single money ledger:** `Payment` is the only authoritative record of money. `PaymentIntent` is a
  transient checkout/intent record, never a ledger.
- **Webhook is the only settler:** the server webhook settles payments; browser success is never
  trusted (`lib/saas/payments/reconcile.ts`).
- **No PAN/card storage** — only `method` + `methodMasked`. No full provider secrets in logs/UI.
- **Secrets encrypted at rest** (AES-256-GCM with `PAYMENT_ENC_KEY`), masked on every read path.
- **Idempotency / duplicate protection:**
  - `Payment.providerPaymentId @@unique` and `PaymentIntent.providerRef @unique`;
  - `PaymentWebhookLog` `@@unique([provider, eventId])` — replay-safe;
  - caller `idempotencyKey` `@unique` on `Invoice` + `Payment` (B-3 closure) — safe retry;
  - `createInvoice`/`recordPayment` fold P2002 into a single logical result.
- **Overpayment protection:** amount matched to invoice intent; mismatch fails reconcile without settling.
- **Refund = four-eyes control:** refund webhooks never self-refund; routed through
  `/saas/financial-approvals` (requester ≠ approver, self-approval blocked).
- **Provider failure does not corrupt invoice state:** transactional; reconciliation is intent-bound.

## Provider catalog (wired `implemented=true`; all `sandbox=true`)
Stripe, Razorpay, PayPal, Adyen, Cashfree, PayU, Checkout.com, Square, Mollie, PhonePe, Paytm,
Easebuzz. **Not wired** (catalog only): Braintree, Authorize.net, Worldpay, CCAvenue, Coinbase
(decommissioned).

## Per-provider production posture (as of this release — all NOT CONFIGURED)
| Provider | Credentials required | Webhook required | Refund | Currencies | Status |
|----------|----------------------|------------------|--------|------------|--------|
| Stripe | publishableKey, secretKey, webhookSecret | HMAC-SHA256 | yes | multi | NOT CONFIGURED |
| Razorpay | key ID/secret, webhook secret | HMAC-SHA256 | yes | INR | NOT CONFIGURED |
| PayPal | client ID/secret, webhook ID | RFC 9421 sig | yes | multi | NOT CONFIGURED |
| Adyen | API key, merchant account, HMAC | HMAC-SHA256 | yes | multi | NOT CONFIGURED |
| (others) | per catalog | per catalog | yes (matrix) | per matrix | NOT CONFIGURED |

## Controls (confirmed repo-side)
1. **No provider becomes READY merely by saving credentials** — a **real connection test** is
   required (test/sandbox) before any READY state.
2. **Test/live credentials are distinguishable** — adapters distinguish test vs live; routing only
   allows live after `confirmLiveActivation` (explicit TEST→LIVE gate).
3. **Webhook secrets protected** — signed (HMAC/RFC 9421/SHA reverse-hash per provider), invalid
   signature/malformed/missing-signature rejected before reconciliation.
4. **Routing** is intent- and capability-bound; no misrouting to an unverified provider.

## Phase 21/22 posture
- **Do NOT activate any live provider** without explicit deployment-owner authorization.
- **Do NOT** execute real charges/refunds/payouts/UPI during smoke testing — sandbox/test only.
- Connect post-launch via sandbox-verified flow per `docs/PAYMENT_WEBHOOKS.md` + `docs/PAYMENT_PROVIDERS.md`.

## Required to reach a provider READY (HOST + BUSINESS, post-launch)
Provision real (test-then-live) credentials · set `PAYMENT_ENC_KEY` (prod) · configure the provider
webhook URL + signing secret · run a sandboxed connection test · explicitly activate live routing ·
register webhook in routing · validate refund/four-eyes flow.
