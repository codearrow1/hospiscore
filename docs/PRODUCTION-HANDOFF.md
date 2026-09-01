# PRODUCTION HANDOFF — EXECUTABLE RUNBOOK (HospiOS SaaS Management App)

**Release:** `9eefac5` · **Branch:** `release/financial-hardening-2026-08-24` · **Date:** 2026-08-29
**Audience:** a deployment owner with Hostinger/hPanel/SSH access but **no familiarity with this
codebase**. Follow top-to-bottom; stop when a check fails and fix before continuing.

**Companion docs (read before starting):**
`PRODUCTION-ENVIRONMENT-MATRIX.md` (env), `HOSTINGER-DEPLOYMENT-CONTRACT.md` (evidence vs. host),
`PRODUCTION-DATABASE-CHECKLIST.md` (DB), `PRODUCTION-CRON.md` (scheduler), `PAYMENT-PRODUCTION-
READINESS.md` (payments), `EMAIL-COMMUNICATION-READINESS.md` (email), `PRODUCTION-SMOKE-PLAYBOOK.md`
(live smoke), `BACKUP-RECOVERY.md` (backup), `OBSERVABILITY.md` (monitoring), `PWA-DEVICE-LAUNCH-
CHECK.md` (PWA), `FINAL-PRODUCTION-ACCEPTANCE.md` (sign-off).

---

## PRODUCT BOUNDARY (read first)
This is the **SaaS management app**: marketing site, online-presence/reputation score tool, Google
claim/verification, SaaS commerce + control plane, marketing lead CRM, affiliate/partner/franchise,
customer self-service. There is **no hotel PMS** (rooms/reservations/folios) — it is marketing copy
only. Don't expect PMS features.

---

## STEP 0 — VERIFY THE RELEASE (do this first, it prevents deploying the wrong code)
```bash
git fetch origin
git checkout release/financial-hardening-2026-08-24
git rev-parse HEAD            # MUST print: 9eefac5  (identical to the documented release)
git status                    # working tree clean
```
If HEAD ≠ `9eefac5`, stop. This runbook targets that exact commit.

## STEP 1 — INSTALL DEPENDENCIES
```bash
npm ci
```
`postinstall` runs `prisma generate` + the prisma runtime fix automatically.

## STEP 2 — SET PRODUCTION ENVIRONMENT (hPanel / .env.production)
Use the values below. **Never print these values in logs or commit them to git.**

| Var | Set to | Note |
|-----|--------|------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `file:./var/saas.db` | **durable** path under your persistent app-data dir; NOT a temp path |
| `PAYMENT_ENC_KEY` | `openssl rand -hex 64` (run locally, paste) | **do not rotate** after provider secrets saved |
| `CRON_SECRET` | random 32+ chars | guards `/api/saas/cron/*` |
| `AFFILIATE_CRON_KEY` | random 32+ chars | guards `/api/saas/cron/affiliate-recurring` |
| `ALLOW_DEMO_SEED` | `0` | **never** `1` in prod |
| `NEXT_PUBLIC_SITE_URL` | `https://thebuddharice.online` | confirmed brand/origin |
| `SITE_URL` | same as above | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | host SMTP | password-reset, dunning, alerts |
| `ALERT_WEBHOOK_URL` | ops webhook (optional) | alerts if SMTP absent |
| `GOOGLE_PLACES_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud key | live property data / claims |
| `ADMIN_EMAILS`, `SALES_EMAIL` | real addresses | |
| `APP_SESSION_COOKIE` / `APP_SESSION_DAYS` | defaults OK | |

Then verify `launch:check` against the env:
```bash
npm run launch:check
```
**Exit 0 expected** (some rows show NOT VERIFIED = host values — that's fine, they're the ones you
just set). HARD failures (schema-migration integrity, secret scan, demo-seed) must not appear.

## STEP 3 — BUILD
```bash
npm run build    # = prisma generate && node scripts/fix-prisma-runtime.mjs && next build
```
Exit 0 expected.

## STEP 4 — BACK UP BEFORE ANY CHANGE
Even on first deploy, snapshot the (empty) DB directory so a later restore path exists. See
`BACKUP-RECOVERY.md`. Never edit production without a backup and a tested restore.

## STEP 5 — APPLY MIGRATIONS (DB)
```bash
npx prisma migrate deploy
```
Exit 0 expected. This applies 23 additive migrations (latest
`20260829010000_caller_idempotency_key`). **Do NOT use `prisma db push` on production.**

## STEP 6 — START THE APP
```bash
npm start    # = prisma migrate deploy && next start   (idempotent)
```
First `npm start` runs `migrate deploy` again (harmless/idempotent), then serves on the configured
port. Confirm it stays up; watch the app log for boot errors.

## STEP 7 — HEALTH CHECK (liveness)
```bash
curl -s https://thebuddharice.online/api/health
```
Must return HTTP **200** with `{"ok":true,"app":"ok","db":"up"}`. If it returns **503**, the DB is
down — stop and fix before proceeding (see `BACKUP-RECOVERY.md`).

## STEP 8 — RUN THE LIVE SMOKE GATE
Follow `PRODUCTION-SMOKE-PLAYBOOK.md`. At minimum:
```bash
npm run smoke    # if SMOKE_BASE_URL is set to the live origin
```
Full 16/16 green expected. Explicitly test the **critical negatives**: signed-out access to a
customer route → 401/403; cross-org claim → 404; a payment with the same `idempotencyKey` twice →
second is rejected. Browser-verify viewports 320–1280 on login/signup/claim/onboarding/billing/admin.

## STEP 9 — WIRE CRON (Hostinger crontab)
For each of the 6 endpoints in `PRODUCTION-CRON.md`, add a scheduler row. Example crontab:
```cron
*/5 * * * *  curl -fsS -H "X-Cron-Secret: $CRON_SECRET"    https://thebuddharice.online/api/saas/cron/lifecycle
*/5 * * * *  curl -fsS -H "X-Cron-Secret: $CRON_SECRET"    https://thebuddharice.online/api/saas/cron/dunning
*/10 * * * * curl -fsS -H "X-Cron-Secret: $CRON_SECRET"    https://thebuddharice.online/api/saas/cron/automation
*/30 * * * * curl -fsS -H "X-Cron-Secret: $CRON_SECRET"    https://thebuddharice.online/api/saas/cron/usage
0 * * * *    curl -fsS -H "X-Api-Key: $AFFILIATE_CRON_KEY" https://thebuddharice.online/api/saas/cron/affiliate-recurring
0 * * * *    curl -fsS -H "X-Cron-Secret: $CRON_SECRET"    "https://thebuddharice.online/api/marketing/cron/followups?send=1"
```
Verify each returns 200 and that the job appears in the cron log.

## STEP 10 — MONITORING
- Uptime monitor on `GET /api/health` (external, every ≥5 min) → alert on **503**.
- Alerts via `ALERT_WEBHOOK_URL` and/or SMTP. Watch hPanel app logs; keep them (do not log secrets).

## STEP 11 — NIGHTLY BACKUP (automate now)
Add a daily job: SQLite `.backup` + JSON copy + env copy, off-machine, retained. Run a **restore
test** to a scratch path and confirm `PRAGMA integrity_check;` returns `ok`. See `BACKUP-RECOVERY.md`.

## STEP 12 — ROLES & FIRST ADMIN
`ALLOW_DEMO_SEED=0` means no seeded `superadmin`. Create your first admin via the sign-up flow, then
promote it to `super_admin` from the SaaS team/RBAC screen (only a `super_admin` can assign
`super_admin` — see the RBAC matrix). Verify the finance/support role separation exists before
opening live billing.

## STEP 13 — PAYMENTS (post-launch; do NOT leave a provider READY at launch)
The app ships **provider-neutral** — no provider is READY, intentionally, until you do this:
1. `super_admin` → SaaS settings → Payments → add provider in **verify/sandbox** mode.
2. Store credentials — they are **AES-256-GCM encrypted at rest** with `PAYMENT_ENC_KEY`, surfaced
   masked only.
3. Run `confirmLiveActivation` (explicit TEST→LIVE gate) before enabling live routing.
4. Configure webhooks — replay-safe via `@@unique([provider,eventId])` + idempotency keys; **the
   server/webhook is the only authoritative settlement** (browser success is never trusted).
See `PAYMENT-PRODUCTION-READINESS.md` for the provider catalog and per-provider posture.

## STEP 14 — SIGN-OFF
Complete the acceptance table in `FINAL-PRODUCTION-ACCEPTANCE.md`: confirm every HOST-VERIFIED gate
(H1–H10) passed, gather the BUSINESS decisions (B1–B5: brand, Terms/Privacy/Refund/Affiliate/Partner
copy, dependency policy, OTP provider, analytics), and set the final status. Only then is the app
**LIVE-VERIFIED** → **LAUNCH READY**.

---

## DO-NOT LIST (these commands/actions are prohibited)
- ❌ `prisma db push` on production — use `prisma migrate deploy`.
- ❌ Rotate `PAYMENT_ENC_KEY` after provider secrets are saved — breaks decryption irreversibly.
- ❌ Set `ALLOW_DEMO_SEED=1` — seeds demo/`superadmin` accounts in prod.
- ❌ Point `DATABASE_URL` at a temp/`C:/Temp` path — data loss + schema drift.
- ❌ Connect/live a payment provider without the explicit live-activation gate.
- ❌ Trust a browser-side payment success without the server webhook settling it.
- ❌ `cp` a hot SQLite file and call it a backup (use `.backup` online backup or drain).
- ❌ Commit/push `.env*` secrets; instead `git rm --cached .env.production` and keep `.env.example`.
- ❌ Log or print `PAYMENT_ENC_KEY`, `CRON_SECRET`, `AFFILIATE_CRON_KEY`, SMTP creds, or provider secrets.
- ❌ Add SW caching for `/api/*`, `/customer/*`, `/saas/*`, billing/payment responses, or error pages.

---

## FAILURE / RECOVERY QUICK REFERENCE
| Symptom | Action |
|---------|--------|
| `GET /api/health` → 503 | DB down. Restore latest good backup (Step 4/11) → `PRAGMA integrity_check` → restart → re-smoke. |
| `migrate deploy` fails | Do not hand-edit migration files. Restore DB, confirm additive-only, re-run. |
| Build fails | `npm ci` fresh; confirm Node/npm versions match `package.json` engines; re-run build. |
| App won't boot | Check `DATABASE_URL` is durable + reachable; confirm `PAYMENT_ENC_KEY` present; read app log. |
| Unknown secret value | Regenerate `CRON_SECRET`/`AFFILIATE_CRON_KEY` freely (host-side only). **Never** regenerate `PAYMENT_ENC_KEY` after provider secrets saved. |
