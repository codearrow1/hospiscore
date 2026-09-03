# Payment environment reference

Environment variables relevant to the payment platform in HospiOS.

## Encryption of provider secrets

| Variable | Effect |
| --- | --- |
| `PAYMENT_ENC_KEY` | Opaque value used to derive the AES-256-GCM key encrypting provider secrets at rest. Set it in production, e.g. to the output of `openssl rand -hex 64`. If unset, a deterministic demo key is derived from `APP_DATA_MIRROR` (self-hosted/demo only — not for production). |
| `APP_DATA_MIRROR` | Base used for the fallback demo encryption key when `PAYMENT_ENC_KEY` is unset. |

## Provider credentials (set in the admin Settings UI, not env)

Gateway credentials and webhook secrets are entered and encrypted through
**Settings → Payments**; they are stored in the payment-provider registry and
never exposed after save. They are not read from environment variables.

| Provider | Credential fields |
| --- | --- |
| Square | Access token, App ID, Location ID, webhook signature key |
| PhonePe PG | Client ID, Client Secret, Client version, webhook checksum secret |
| Paytm | MID (merchant id), Merchant key, Website |
| Easebuzz | Merchant key, Salt, Merchant email |
| Stripe / Razorpay / PayPal / Adyen / Checkout.com / Mollie / Cashfree / PayU | Standard secret keys + webhook secrets (shown by the credential wizard) |

See `docs/PAYMENT_PROVIDERS.md` for the full wiring and webhook verification
details.
