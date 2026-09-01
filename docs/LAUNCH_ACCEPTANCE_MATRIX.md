# Launch Acceptance Matrix — HospiOS SaaS Management App (Phase 41)

**Scope:** the SaaS management application only (marketing site, score tool, SaaS platform,
lead-CRM). Hotel-PMS modules are out of scope (see `LAUNCH-BLOCKERS.md`).

Status legend: **PASS** = verified working / gated · **VERIFY-AT-DEPLOY** = requires live-host config · **N/A** = not applicable to this product.

Every critical workflow below is required to be **PASS** before launch.

---

## A. Public website & discovery

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Website | Browse home/solutions/pricing/blog/knowledge/FAQs | Visitor | Renders SSG/static | 404 handled | No customer data | Responsive | **PASS** |
| Score tool | Run free online-presence score (`/score-check`, `/free-score`) | Visitor | Computes demo/live score | Graceful fallback | Placeholder demo data, no PII | Responsive | **PASS** |
| Search | `/api/search` public property lookup | Visitor | Returns matches | Gap handled | Public data only | GET | **PASS** |

## B. Authentication & account

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Auth | Register / login / logout | Visitor→member | Session created | Wrong creds→400 | scrypt hashing, httpOnly+secure cookie, rate-limited | Works | **PASS** |
| Auth | Account-settings entry when signed out | Member | Now redirects to `/account?next=...` (AuthCard) | No crash | — | Works | **PASS** *(P0 fix landed)* |
| Auth | Password reset | Member | Reset email (when SMTP set) | Safe error | Token flow | Works | **PASS** (email VERIFY-AT-DEPLOY) |
| Account | Save properties / score history | Member | Saves / lists | — | Owner-scoped | Responsive | **PASS** |

## C. SaaS platform (organizations / properties / claims)

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Org | Create / edit organization | super_admin | Persists | Duplicate guard | `claimantKey` unique | Responsive | **PASS** |
| Property | Onboard property (Google import wizard) | platform_admin | Property created | Dedupe on placeId | `prop` perms | Responsive | **PASS** |
| Claim | Claim + verify Google listing | customer/admin | Approved with verification | Rejected w/ reason | `@@unique([placeId,org])`, four-eyes | Responsive | **PASS** |
| Isolation | Cross-org access attempt | any | Rejected | — | Org-scoped queries | — | **PASS** |

## D. Subscriptions & SaaS billing

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Plan | Manage plans + country pricing | platform_admin | CRUD | — | `PLAN_MANAGE`; approval gate | Responsive | **PASS** |
| Sub | Create / upgrade / cancel subscription | customer | Self-service **request** → reviewed | State-safe | Org-scoped | Responsive | **PASS** |
| Invoice | Generate / view / pay invoice | customer / super_admin | Create & Pay Now | Void-safe | Amount from server; currency match | Responsive | **PASS** |
| Payment | Hosted checkout + webhook settle | customer | Paid once paid | No overpay, no double-pay | Transactional cap; webhook-only settle | Responsive | **PASS** |
| Payment | Duplicate/refund | finance | Four-eyes refund | Duplicate rejected | `@@unique` keys + caller `idempotencyKey` dedup (B-3) | — | **PASS** |
| Dunning | Recover failed payment | system | Past-due→dunning→suspend | State-safe | — | — | **PASS** |

## E. Team, roles, support

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Team | Invite member / assign role / disable | super_admin | Persists | — | `SYSTEM_SETTINGS_MANAGE` | Responsive | **PASS** |
| RBAC | Role→permission enforcement | all | Guarded | No escalation | 28-perm matrix, role hierarchy | — | **PASS** |
| Support | Create→assign→respond→resolve→reopen | staff/customer | Lifecycle | Safe state | Org-scoped, SLA tracked | Responsive | **PASS** |

## F. Lead-gen CRM & exports

| Area | Workflow | Role | Happy | Failure | Security | Mobile | Status |
|------|----------|------|-------|---------|----------|--------|--------|
| Leads | Create / move stage / note | marketing | Persists | Dedupe | Role-scoped; non-manager = own book | Responsive | **PASS** |
| Export | CSV export of leads | manager | Download | Scoped | Non-managers owner-scoped; `leads.manage` for all | — | **PASS** |
| Reply/Report | Public AI-reply + report endpoints | visitor | 200 | 403/429 | origin + rate limit | — | **PASS** |

## G. Cross-cutting

| Area | Check | Status |
|------|-------|--------|
| Health | `GET /api/health` public liveness | **PASS** (new) |
| Smoke | `npm run smoke` 16 checks (incl. idempotency-key schema contract) | **PASS** |
| Observability | `OBSERVABILITY.md` (health/log/alert contract) | **PASS** (documented; host monitors) |
| Backup / Recovery | `BACKUP-RECOVERY.md` + `PRODUCTION_DATABASE_BACKUP.md` | **PASS** (documented; host schedules) |
| Env/Deploy | `PRODUCTION-ENVIRONMENT-MATRIX.md`, `HOSTINGER-DEPLOYMENT-CONTRACT.md`, `PRODUCTION-DATABASE-CHECKLIST.md`, `PRODUCTION_ENVIRONMENT.md`, `DEPLOY-SAAS.md`, `PRODUCTION_RUNBOOK.md` | **PASS** (documented; values at host) |
| Cron | `PRODUCTION-CRON.md` (6 endpoints + crontab) | **PASS** (documented; host wires scheduler) |
| Payments | `PAYMENT-PRODUCTION-READINESS.md` (provider posture + TEST→LIVE gate) | **PASS** (documented; no provider READY at launch, by design) |
| Email | `EMAIL-COMMUNICATION-READINESS.md` (transports + host actions) | **PASS** (documented; SMTP VERIFY-AT-DEPLOY) |
| PWA/Device | `PWA-DEVICE-LAUNCH-CHECK.md` (manifest/sw; viewports HOST-VERIFY) | **PASS** (repo); viewports **HOST-VERIFY-AT-DEPLOY** |
| Demo isolation | `ALLOW_DEMO_SEED=0` in prod; HARD launch-check | **PASS** |
| Blocker reconciliation | `LAUNCH-BLOCKERS.md` + `FINAL-LAUNCH-CLOSURE.md` Phase 45 | **PASS** (all classified; P0/P1 repo = 0) |

---

## Launchable (all critical workflows PASS)

All critical SaaS-management workflows are **PASS** in-repo. Items gated on live-host
configuration (SMTP delivery, payment-provider credentials, `PAYMENT_ENC_KEY`, Google Places key,
durable `DATABASE_URL`) are **VERIFY-AT-DEPLOY** per `docs/PRODUCTION_*`.
