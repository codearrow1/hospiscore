# HOSTINGER DEPLOYMENT CONTRACT — HospiOS SaaS Management App

**Release:** `9eefac5` (`release/financial-hardening-2026-08-24`) · **Domain:** `https://thebuddharice.online`
**Status:** repository-side contract derived from repo config + docs. Items the host must confirm are
marked **HOST-SIDE VERIFICATION REQUIRED** — never assumed without repository/host evidence.

---
## 1. Repository evidence (verified this release)

| File | What it establishes |
|------|---------------------|
| `package.json` | `build` = `prisma generate && node scripts/fix-prisma-runtime.mjs && next build`; `start` = `prisma migrate deploy && next start`; `postinstall` = `prisma generate && node scripts/fix-prisma-runtime.mjs`; `db:migrate` = `prisma migrate deploy`. Node runtime via engines/Next 15. |
| `next.config.ts` | Runtime `nodejs`; security headers (HSTS preload, `X-Frame-Options: DENY`, etc.); Prisma CJS alias; `images.remotePatterns` = `images.unsplash.com` only. |
| `prisma.config.ts` | Schema `prisma/schema.prisma`; migrations dir; `engine: "classic"`; datasource `DATABASE_URL` (fallback `file:./var/saas.db`). |
| `scripts/fix-prisma-runtime.mjs` | Post-generate patch that maps the Prisma query-engine runtime to `library.js` — required to dodge the classic `async_hooks`/`crypto`/`fs/promises` Node bundling failures on hPanel. Runs in `postinstall` and `build`. |
| `.env.production` | `ALLOW_DEMO_SEED=0` only (secret-free; recommended to `git rm --cached`). |
| `docs/DEPLOY-SAAS.md` | GitHub → Hostinger → build → runtime pipeline; cron registration; rollback. |

## 2. Exact host requirements

| Requirement | Value | Evidence | HOST-SIDE VERIFICATION REQUIRED? |
|-------------|-------|----------|----------------------------------|
| Node version | Latest 20.x LTS (and ≥22.5 for JSON `DATA_PROVIDER=sqlite`, not used in prod SaaS). | package.json / Next 15 | Yes — confirm hPanel Node major |
| Install command | `npm ci` (uses `package-lock.json`) | package.json | No |
| Build command | `npm run build` (runs prisma generate + runtime patch + next build) | package.json | No |
| Start command | `npm run start` (= `prisma migrate deploy && next start`) | package.json | No |
| Migration command | `npx prisma migrate deploy` (self-provisioning; **no `prisma db push` on prod**) | DEPLOY-SAAS.md §2, handoff §4 | No |
| Root directory | Repo root (where `package.json` + `next.config.ts` live) | — | Yes — hPanel app root |
| Environment | See `PRODUCTION-ENVIRONMENT-MATRIX.md` (DATABASE_URL, PAYMENT_ENC_KEY, CRON_SECRET, AFFILIATE_CRON_KEY, SITE_URL, SMTP, Google keys) | config | Yes — set at hPanel |
| Database | Durable SQLite path **without spaces** inside `var/` (e.g. `file:/home/<user>/<app>/var/saas.db`); `var/` excluded from deploys but backed up | `.gitignore` `/var/`, DEPLOY-SAAS.md §1 | Yes — confirm path + perms |
| Cron | 6 endpoints (see `PRODUCTION-CRON.md`) wired in Hostinger → Advanced → Cron Jobs with secrets | DEPLOY-SAAS.md §3 | Yes — register |
| Persistent storage | `var/` (DB + JSON data + scores) must survive/app-directory deploys; use absolute no-space path | DEPLOY-SAAS.md §1 | Yes |
| Prisma engine | `engine: "classic"` + CJS runtime patch handled automatically by postinstall/build | prisma.config.ts | No (patch is automatic) |

## 3. Non-goals / guardrails
- **Do NOT** run `prisma db push` against production; use `migrate deploy`.
- **Do NOT** copy the local `DATABASE_URL="file:C:/Temp/saas.db"` (dev-only, path has spaces).
- **Do NOT** set `ALLOW_DEMO_SEED=1`.
- **Do NOT** rotate `PAYMENT_ENC_KEY` after provider secrets are saved.
- **Do NOT** manually patch production (e.g. the Prisma runtime) — fix in-repo, run gates, redeploy.
- **Do NOT** change GitHub rulesets / bypass branch protection.

## 4. Verified host behavior still REQUIRED to confirm (cannot be proven repo-side)
1. GitHub→Hostinger auto-deploy wiring and that it deploys exactly `9eefac5`.
2. `npm run build` succeeds under hPanel's Node/environment (Prisma generation + CJS patch + `next build`).
3. `npm run start` boots and self-provisions the DB via `migrate deploy` (23 migrations).
4. `/api/health` returns `200 {ok:true, db:"up"}`.
5. `var/` persistence across deploys/restarts; writable by the app user.
6. The 6 cron jobs fire with correct secrets/headers and return `{"ok":true,…}`.
