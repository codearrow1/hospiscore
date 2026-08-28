# Launch Blockers

Repo-side register of everything that must be resolved before (or at) launch,
and what was hardened during Phase N. Live-host verification items are marked
`NOT VERIFIED` and can only be closed by an operator with deployment access.

Legend: `RESOLVED` = fixed in the repo during Phase N; `OPEN` = still required
(host action or decision); `NOT VERIFIED` = requires live-host confirmation.

## Security / correctness (must be closed)

| # | Blocker | State | Detail |
| --- | --- | --- | --- |
| L-01 | Payment connection-test masking bug | **RESOLVED** | `validate.ts` built live config with display-masked secrets, so CONNECTED was unachievable; plaintext bundles now threaded through (factory + adapter). Proven by a regression test. |
| L-02 | Marketing → SaaS privilege escalation | **RESOLVED** | `marketing_admin` could self-promote to `super_admin` via the marketing users PATCH route. Only an existing `super_admin` may assign `super_admin`; non-super-admins cannot change their own role. |
| L-03 | SaaS-only roles unassignable | **RESOLVED** | `setUserRole` rejected SaaS-only roles (`finance_admin`, `support_admin`…), breaking separation of duties. Now accepts the union of marketing + SaaS roles. |
| L-04 | Control-plane diagnostics exposed to any marketing role | **RESOLVED** | `requireMarketingUser()` gate downgraded to require `SYSTEM_SETTINGS_MANAGE` (super-admin scope). |
| L-05 | Dead `/login` redirect loop | **RESOLVED** | 11 protected pages redirected to a non-existent `/login`. Now redirect to `/account` (the real sign-in surface). No `/login` route remains. |
| L-06 | Demo seeding enabled in production | **RESOLVED** | Tracked `.env.production` set `ALLOW_DEMO_SEED=1`, which seeds demo/`superadmin` accounts in prod (`lib/marketing/seed.ts:20`). Now `ALLOW_DEMO_SEED=0`. `launch:check` enforces it. |
| L-07 | Env secrets committed | **WARN / OPEN** | `.env.production` is tracked but verified secret-free. Best practice: `git rm --cached .env.production` and keep `.env.example` as the template. |
| L-08 | SEO robots path bug | **RESOLVED** | `robots.ts` disallowed a non-existent `/property/` path, letting thin `/properties/*/claim` pages be indexed and internal panels be crawlable. Correct paths + internal panels now disallowed. |

## Host / deployment (operator action — `NOT VERIFIED` repo-side)

| # | Blocker | State | Detail |
| --- | --- | --- | --- |
| L-20 | Hostinger deployment access | **OPEN / NOT VERIFIED** | No Hostinger CLI, hPanel creds, or SSH route. Deployment and live boot-under-hPanel confirmation are blocked. |
| L-21 | Production `DATABASE_URL` | **NOT VERIFIED** | Must be `file:.../var/saas.db` on the host; `var/` kept out of deploys but in backups. |
| L-22 | Production `PAYMENT_ENC_KEY` | **NOT VERIFIED** | Set to `openssl rand -hex 64`; do not rotate once provider secrets are saved. |
| L-23 | Production `CRON_SECRET` / `AFFILIATE_CRON_KEY` | **NOT VERIFIED** | Required for scheduler-triggered endpoints. |
| L-24 | Any CONNECTED/READY payment provider | **NOT VERIFIED** | None is CONFIGURED/READY. Deliberately left provider-neutral at launch; connect post-launch with a verified sandbox flow per `docs/PAYMENT_WEBHOOKS.md`. |
| L-25 | Backup schedule on host | **NOT VERIFIED** | See `docs/PRODUCTION_DATABASE_BACKUP.md`; set up nightly SQLite `.backup` + JSON copy. |
| L-26 | Webhook URL + signing secrets per provider | **NOT VERIFIED** | Configure only when a provider is actually enabled. |

## Outstanding doc / tooling

- `npm run launch:check` is the automated gate; it currently exits `0` with
  WARN/NOT VERIFIED items only. Run it before every release.
- Above OPEN/NOT VERIFIED rows require an operator with host access to close.
