# Payment Webhooks (Production Readiness)

Reference for the payment webhook surface and what must be true before a
provider is enabled for real payments. The webhook endpoint is the **only**
authoritative settlement path — a browser success page is never trusted.

## Endpoint

```
POST /api/payments/webhook/[provider]
```

- `[provider]` is the lowercase provider id (e.g. `stripe`, `square`, `razorpay`).
- No session/auth cookie is required. Authenticity is established solely by
  per-provider **signature verification**.
- Managed by `app/api/payments/webhook/[provider]/route.ts`, which delegates to
  `reconcileWebhook(...)` in `lib/saas/payments/reconcile.ts`.

## Verification model

- On receipt the raw request body plus full headers are handed to the provider
  adapter for signature/checksum verification.
- A signature/verification failure surfaces as a `GatewayError` and returns
  `400` with `Verification failed`. These are treated as bad requests or
  tampering, **not** provider-outage events (they do not decrement provider
  health).
- A business-level reconciliation failure surfaces as `WebhookReconcileError`
  and returns `400` with `Reconciliation failed`, and is recorded as a provider
  health outcome.
- Unexpected errors return `500`.
- An unknown provider id returns `404`.

## Production checklist (per provider)

| Check | Detail | Status |
| --- | --- | --- |
| Webhook URL configured | Point the gateway to `https://thebuddharice.online/api/payments/webhook/<provider>` in the provider dashboard. | `NOT VERIFIED` (host action) |
| Webhook signing secret set | Enter the gateway's signing/checksum secret in **Settings → Payments** (stored encrypted). | `NOT VERIFIED` |
| Signature verification passed | Confirm a real test webhook returns `200` and settles the test invoice server-side. | `NOT VERIFIED` |
| Idempotency | Reconciliation must be idempotent — a re-delivered webhook must not double-settle. | Verified in code; live re-test required |
| Event coverage | For providers with typed events, subscribe to the events the reconcile layer handles (payment succeeded / refund / failure). | Per provider |
| Logging | Failed verifications are logged; monitor for tampering bursts. | Enabled in code |

## Rules

- Never expose the webhook in `robots.txt` (it is under `/api`, already
  disallowed).
- Do not add session auth to the webhook — signature verification is the
  authentication mechanism by design.
- Browser success (`/success` pages) must never mark an invoice paid on their
  own; only server-confirmation via webhook settles.

## Current readiness

`npm run launch:check` reports that **no gateway provider is in a
`ready`/`verify` (routable) state** and, per `docs/PAYMENT_PROVIDERS.md`, no
provider is actually CONFIGURED/READY for live traffic. Webhook
prod-readiness therefore remains `NOT VERIFIED` until a provider is connected,
which is deliberately left as a post-launch/host action.
