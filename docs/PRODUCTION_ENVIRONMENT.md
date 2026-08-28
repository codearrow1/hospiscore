# Production Environment Reference

Repository-side environment inventory for the HospiOS production deployment
(target host: hPanel / Hostinger, domain `https://thebuddharice.online`).

> Scope note: this is the repository-side inventory. Live values are set on the
> hosting control panel (hPanel) at deploy time and are **not** stored in git.
> Anything that must be confirmed against the live host is marked
> `NOT VERIFIED`. Values are validated automatically by `npm run launch:check`.

## Required (app will not boot correctly without them)

| Variable | Purpose | Verified repo-side? |
| --- | --- | --- |
| `DATABASE_URL` | Prisma connection string. Production: a local SQLite file inside `var/` (e.g. `file:./var/saas.db`). Keep `var/` out of deploys but inside the backup routine. | `NOT VERIFIED` (host-provided) |
| `PAYMENT_ENC_KEY` | Opaque value that derives the AES-256-GCM key encrypting payment-provider secrets at rest. Set to `openssl rand -hex 64`. If unset in production, secrets are not high-assurance encrypted. | `NOT VERIFIED` (host-provided) |

## Required for production hardening

| Variable | Purpose | Notes |
| --- | --- | --- |
| `CRON_SECRET` | Shared secret for `POST /api/saas/cron/dunning` and `POST /api/saas/cron/automation` (`X-Cron-Secret` header). | Must be set so only the scheduler can trigger them. |
| `AFFILIATE_CRON_KEY` | Secret for the affiliate cron endpoint. | Set if affiliate automation is used. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for SEO (robots/sitemap/OG). Must be `https://thebuddharice.online`. Falls back internally and rejects localhost/non-HTTPS. | Recommended. |
| `SITE_URL` | Legacy canonical origin override. | Recommended (matches `NEXT_PUBLIC_SITE_URL`). |
| `ADMIN_EMAILS` | Comma-separated lead/admin emails for role tiering and `/account/leads`. | Set to the operator's email. |
| `SALES_EMAIL` | Sales contact email shown across marketing surfaces. | Recommended. |

## Recommended / optional

| Variable | Purpose |
| --- | --- |
| `APP_DATA_FILE` | JSON document backing owner accounts / sessions / saved properties. Default `<project>/var/data.json`. |
| `APP_DATA_MIRROR` | Secondary copy base for the data document; also the source of the demo-only encryption fallback. Keeps data safe across deploys that replace the app dir. |
| `APP_SESSION_COOKIE` | Session cookie name (default `hs_session`). |
| `APP_SESSION_DAYS` | Session lifetime in days (default 30). |
| `DEEPSEEK_API_KEY` | AI review-draft provider key. |
| `GOOGLE_PLACES_API_KEY` | Server-side Places API key (live data mode). |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Public Maps JavaScript API key (client autocomplete). |
| `REVIEW_PROVIDER` | OTA review source selector (`demo`/`stayapi`/`apify`). |
| `ALLOW_DEMO_SEED` | Must be `0` (or unset) in production. See Security below. |
| `PRISMA_QUERY_ENGINE_LIBRARY` | Optional; resolves the Prisma query engine on hosts that do not ship `lib/generated` (hPanel). |

## Security rules

- **No `.env` files are committed with real secrets.** A lightweight `.env.production`
  containing only `ALLOW_DEMO_SEED=0` is tracked but verified secret-free; the
  recommended end state is to remove it from git entirely (`git rm --cached`).
- **`ALLOW_DEMO_SEED` MUST be `0` in production.** `lib/marketing/seed.ts:20`
  permits seeding demo marketing accounts (including a `superadmin@hospios.demo`)
  in production **only** when it equals `"1"`. `grep` for `ALLOW_DEMO_SEED=1`
  before launch. Verified `!= 1` by `npm run launch:check`.
- Provider gateway credentials and webhook secrets are entered in
  **Settings → Payments** and stored AES-256-GCM encrypted; they are never read
  from env vars (see `docs/PAYMENT_ENV.md`).
- `PAYMENT_ENC_KEY` must not be rotated carelessly: rotating it orphaned existing
  encrypted provider secrets.

## Validation

`npm run launch:check` prints a sectioned PASS / FAIL / WARN / NOT VERIFIED
report across Environment, Payment provider integrity, Database startup,
Routing / dead links, Secrets hygiene, and Production flags. It does not deploy
or touch production.
