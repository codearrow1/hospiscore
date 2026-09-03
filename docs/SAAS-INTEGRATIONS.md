# HospiOS — SAAS Integrations

> Grounded in the actual code. Companion: `docs/PAYMENT_PROVIDERS.md`
> (operator guide, provider status machine).

Integration honesty rule: a provider/integration is only **Ready** after a real
connection test succeeds in a Test/Sandbox or Live environment. The system
never fabricates readiness from mere credential entry. Never mark something
**LIVE** in docs/code/UI unless it is actually activated.

---

## Payment providers

Provider-neutral gateway architecture in `lib/saas/payments/**` and
`lib/saas/adapters/*` (extend `BasePaymentAdapter`). Providers wired:

- **Stripe**, **Razorpay**, **PayPal**, **Adyen**, **Cashfree**, **PayU**,
  **Checkout.com**, **Square**, **Mollie**, **PhonePe**, **Paytm**,
  **Easebuzz**, plus a **generic** adapter.

They are **WIRED**, not necessarily **LIVE**. Register defaults in
`lib/saas/payments/catalog.ts` and capabilities in
`lib/saas/payments/capabilityMatrix.ts`. Live activation requires
`confirmLiveActivation` persisted in `SystemSetting("payment_providers")`
with `mode: "test" | "live"`.

Config surfaces:

- `/api/saas/payments/providers` and `/api/saas/payments/providers/[id]`
- `PaymentProviderHealth` (health ledger), `PaymentWebhookLog` (append-only
  webhook events), `PaymentProviderHealth` status view.
- Webhook receiver: `/api/payments/webhook/[provider]`.

Credentials are encrypted at rest (`lib/saas/payments/crypto.ts`); webhook
signatures verified there too.

---

## Property intelligence / data providers

`lib/providers/`:

| Provider | Status |
|---|---|
| `google.ts` — Google Places (place details, photos, reviews) | **LIVE** integration |
| `reviews.ts` — OTA reviews (Stayapi/Apify) | **DEMO MODE** — returns mock data when no API keys are configured |

---

## Integrations surfaces (SaaS settings)

- `/saas/settings/integrations` UI + `/api/saas/*` provider/config routes.
- `FeatureFlag` gates features/integrations by plan/org/property/country/
  percentage/beta.
- `/api/saas/cron/automation` drives rule-based automation (email etc.)
  logged in `AutomationEvent`.

---

## External PMS

The operational PMS is **out of scope** and referenced only as a dependency of
this SaaS layer via `Property.pmsInstanceUrl` and the integration interfaces it
requires. Document only the interface/dependency the SaaS layer needs.

---

## Status legend

Use these categories in any integration listing:

- **LIVE** — real connection verified in production.
- **SANDBOX / TEST** — verified against a provider sandbox.
- **CONFIGURED** — credentials present but no successful connection test.
- **UNAVAILABLE** — not reachable/not configured.
- **PLANNED** — design exists but not wired.

Do not claim an integration is operational without evidence.
