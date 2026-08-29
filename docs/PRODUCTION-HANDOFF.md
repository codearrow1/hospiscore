# PRODUCTION HANDOFF — HospiOS SaaS Management App

**Branch:** `release/financial-hardening-2026-08-24` · **Date:** 2026-08-29
**Purpose:** actionable operator/deploy handoff for taking the repo live on Hostinger/hPanel.
**Companion docs (read first):** `docs/PRODUCTION_ENVIRONMENT.md`, `docs/PRODUCTION_RUNBOOK.md`,
`docs/PRODUCTION_DATABASE_BACKUP.md`, `docs/DEPLOY-SAAS.md`, `docs/PAYMENT_WEBHOOKS.md`,
`docs/PAYMENT_PROVIDERS.md`, `docs/LAUNCH-BLOCKERS.md`, `docs/FINAL-LAUNCH-CLOSURE.md`.

---

## 1. Product boundary (what this is / isn't)

This is the **SaaS management app**: marketing site, online-presence/reputation score tool,
Google claim/verification, SaaS commerce + control plane, marketing lead CRM, affiliate/partner/
franchise, customer self-service. The **operational hotel PMS is NOT built** (marketing copy only)
— do not expect PMS features.

## 2. Two data planes (back up both)

1. **Prisma / SQLite** — SaaS commerce (orgs, properties/claims, plans, subscriptions, invoices,
   payments, audit, support, affiliates/partners/franchise). Prod DB **must** be a durable path
   (`file:./var/saas.db`), not the local temp fallback `file:C:/Temp/saas.db`.
2. **JSON store** (`var/data.json` + `var/scores/`) — accounts/sessions + marketing lead CRM +
   score history.

Back up both every night: SQLite `.backup` + JSON copy + `PAYMENT_ENC_KEY` offline (see
`PRODUCTION_DATABASE_BACKUP.md`).

## 3. Required environment at deploy

| Env | Why | Set to |
|-----|-----|--------|
| `DATABASE_URL` | Invoices/payments/orgs/leads SaaS plane | durable `file:./var/saas.db` |
| `PAYMENT_ENC_KEY` | AES-GCM decrypt of encrypted provider secrets | `openssl rand -hex 64` (do **not** rotate after secrets saved) |
| `CRON_SECRET` / `AFFILIATE_CRON_KEY` | Protect `/api/cron/*` + affiliate cron | high-entropy random |
| `GOOGLE_PLACES_API_KEY` | Live property data (leave demo mode) | Google Cloud credential |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Public maps (claims/wizard) | Google Cloud credential |
| SMTP (`SMTP_HOST/PORT/USER/PASS/FROM`) | password-reset, dunning, notifications, alerts | host SMTP |
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | Canonical origin | `https://thebuddharice.online` |
| `ALLOW_DEMO_SEED` | demo/superadmin seeding | **0** in prod (`launch:check` enforces) |

`launch:check` will HARD-fail if `PAYMENT_ENC_KEY`/live data mode are misconfigured in production
and will flag the schema/migration + source-secret hygiene.

## 4. Deploy / run

```
npm ci
npm run build          # = prisma generate && fix-prisma-runtime && next build
npx prisma migrate deploy   # 23 migrations incl. 20260829010000_caller_idempotency_key
npm run start                # = prisma migrate deploy && next start  (idempotent)
```

New model/db changes must ship as **additive** migrations (`npx prisma migrate dev` locally,
deploy `migrate deploy` in prod). The B-3 idempotency migration is purely additive.

## 5. Payment providers — connect post-launch (do NOT leave READY at launch)

Provider-neutral at launch is intentional. To go live with a provider:
1. `super_admin` → SaaS settings → Payments → add provider in `verify` mode (sandbox).
2. Store provider credentials — they are **encrypted at rest** (AES-256-GCM with
   `PAYMENT_ENC_KEY`) and only ever surfaced masked.
3. `confirmLiveActivation` (explicit TEST→LIVE gate) before enabling live routing.
4. Configure webhooks — replay-safe via `@@unique([provider,eventId])` + idempotency keys;
   **server/webhook is the only authoritative settler** (browser success is never trusted).

## 6. Cron (scheduled jobs)

All require a shared secret header. Wire your scheduler (Hostinger cron / external) to hit:
- `/api/saas/cron/dunning` (recover failed payments), `/cron/usage`, `/cron/lifecycle`,
  `/cron/automation`, `/cron/affiliate-recurring` (`AFFILIATE_CRON_KEY`).
- `/api/marketing/cron/followups` (lead follow-up emails) — `CRON_SECRET`.

## 7. Monitoring

- Probe **`GET /api/health`** (public liveness) — `200 {ok, db:"up"}` / 503 when DB down. Alert on
  503.
- Watch Hostinger hPanel logs; audit trail is write-once in the `AuditLog` table; payment traces in
  `PaymentWebhookLog`.
- Establish a nightly job: DB + JSON backup + optional verification (see
  `PRODUCTION_DATABASE_BACKUP.md`).

## 8. Known accepted-deferred (monitor; schedule later)

- **Post-launch hardening:** O-23 `/api/affiliate/track`, O-24 `/api/demo`, O-25
  `/api/properties/claim/start` (missing `originAllowed`) — abuse/CSRF ratelimit+origin.
- **B-5** structured logging / request IDs (adds traceability; not a launch blocker).
- **B-6** dependency audit (6 high, transitive build-tooling) — schedule a breaking `next@16` /
  prisma upgrade deliberately, not force-fixed on a release day.
- **O-21/O-22** password-reset session revocation / single-session rotation.
- **O-02** OTP delivery hook for claim verification — pick a provider.
- **O-26/O-27** affiliate/franchise notification wiring; **O-41** analytics decision.

## 9. Open business decisions

1. Confirm `thebuddharice.online` as canonical brand/origin.
2. Sign off Terms/Privacy/Refund/Affiliate/Partner policy text.
3. Schedule the dependency-upgrade policy.
4. Pick OTP delivery + analytics providers.

## 10. Do-not list (operational guardrails)

- Do **not** set `ALLOW_DEMO_SEED=1` in prod.
- Do **not** rotate `PAYMENT_ENC_KEY` after provider secrets are saved (breaks decryption).
- Do **not** point `DATABASE_URL` at a temp path (data loss + drift).
- Do **not** connect/live a payment provider without the explicit live-activation gate.
- Do **not** push raw `.env*` secrets to git; untrack `.env.production` (best practice: `git rm --cached .env.production`).
