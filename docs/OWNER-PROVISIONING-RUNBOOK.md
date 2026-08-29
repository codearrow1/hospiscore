# OWNER PROVISIONING RUNBOOK — HospiOS Production (Phase 50 → Go-Live)
**Applies to:** `https://thebuddharice.online` (Hostinger hbuilds, release branch)
**Intended executor:** site owner / hosting admin (several steps are hPanel-dashboard-only).
**Execution policy:** all commands are run **by the owner**; nothing here auto-executes. Secrets below are
**placeholders** — the owner generates real high-entropy values with the given `openssl`/`node` commands.
**Current host state (verified 2026-08-29):** `config/.env` contains only `DATABASE_URL` + `GOOGLE_PLACES_API_KEY`.
`data.json` lives at `hbuilds/current/nodejs/var/data.json` (version-tied; see item 5).

---

## 0. Pre-flight (read-only checks before any change)
```bash
H=/home/u774769673/domains/thebuddharice.online/hbuilds
# env keys present today (redacted names)
grep -oE '^[A-Z_]+=' $H/config/.env || echo "no $H/config/.env"
# live health
curl -fsS https://thebuddharice.online/api/health          # expect 200 {"ok":true,"app":"ok","db":"up"}
# confirm durable DB path (from DATABASE_URL, e.g. <mirror>/app.db)
grep '^DATABASE_URL' $H/config/.env
```
> Do **not** rotate `PAYMENT_ENC_KEY` after secrets are saved — encrypted secrets become undecryptable
> (`BACKUP-RECOVERY.md`). Set it **once, before** any provider is configured.

---

## 1. H4 — Payment encryption key (`PAYMENT_ENC_KEY`)
> Requirement: set it **before** the first provider configuration (won't re-encrypt). `launch:check`
> hard-fails in production if unset.
```bash
# 1) Generate a high-entropy key (run ONCE, keep + vault it offline):
openssl rand -hex 64        # 128-char hex — this is your PAYMENT_ENC_KEY
# 2) Add to the host config .env (owner edits the file, or use the value in hPanel Advanced > Environment):
H=/home/u774769673/domains/thebuddharice.online/hbuilds/config/.env
printf '\nPAYMENT_ENC_KEY=YOUR_128_HEX_BELONGS_HERE\n' >> $H/.env
# 3) Persist in the host secure vault + a sealed offline copy (BACKUP-RECOVERY.md §6).
```
**Verify**
```bash
grep -q '^PAYMENT_ENC_KEY=..\{32,\}$' $H/config/.env && echo "PAYMENT_ENC_KEY present (>=33 chars)" || echo "MISSING"
curl -fsS https://thebuddharice.online/api/health            # still 200
# Launch gate: run the production launch check (requires NODE_ENV=production) — expect no H4 failure.
```
> The env may also be injectable via **hPanel Advanced → Environment Variables**; if the app reads a
> different `.env`, set it there too (the app and cron jobs must see the SAME value).

---

## 2. H5 — Cron secrets + Hostinger cron job registration
> All six endpoints require a shared-secret header; without the secret they return 401 (fail-closed).
> Registration is a **HOST ACTION** (Hostinger → Advanced → Cron Jobs). See `PRODUCTION-CRON.md`.
```bash
# Generate two separate high-entropy secrets (do NOT reuse PAYMENT_ENC_KEY):
openssl rand -hex 32   # CRON_SECRET   (64 hex chars)
openssl rand -hex 32   # AFFILIATE_CRON_KEY
# Add both to the same config/.env the app reads (and/or hPanel env):
H=/home/u774769673/domains/thebuddharice.online/hbuilds/config/.env
printf 'CRON_SECRET=YOUR_CRON_SECRET_HERE\nAFFILIATE_CRON_KEY=YOUR_AFFILIATE_KEY_HERE\n' >> $H/.env
```
Make sure the running process picks up the new vars (host restart/redeploy of the Node app) so the cron
calls and server agree.
**Wired cron entries (Hostinger hPanel → Advanced → Cron Jobs — stagger times; run once manually to
confirm `{"ok":true,…}`):**
```cron
10 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/dunning >/dev/null
25 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/lifecycle >/dev/null
40 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/automation >/dev/null
55 3 * * *  curl -fsS -X POST -H "X-Api-Key: <AFFILIATE_CRON_KEY>" https://thebuddharice.online/api/saas/cron/affiliate-recurring >/dev/null
10 4 1 * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/usage >/dev/null
0  8 * * *  curl -fsS -X GET  -H "X-Cron-Secret: <CRON_SECRET>" "https://thebuddharice.online/api/marketing/cron/followups?send=1" >/dev/null
```
> `usage` runs 1st-of-month (04:10) and is inert until `usage_overage_rates` is configured — leave it
> wired; it's a no-op until rates exist. Run each **once** to confirm 200; never spam for testing.

**Verify:** each cron's Hostinger log shows `200`; a forged call with a wrong secret returns `401`
(fail-closed confirmed).

---

## 3. H8 — Uptime monitoring on `/api/health`
> Contract: external uptime probe on `GET /api/health` ≥ every 5 min, page `200`; alert on `503`
> (DB down). Public endpoint, no secrets → safe to monitor. See `OBSERVABILITY.md`.
1. Create an **uptime monitor** in your monitoring tool (Hostinger Website Monitor, UptimeRobot,
   Grafana Cloud, StatusCake, etc.) on:
   `GET https://thebuddharice.online/api/health` → expected status `200`, check every 5 min.
2. Set **failure alert** for `== 503` (DB down) and for `!= 200` (non-2xx): email/SMS/webhook to ops.
3. Optional app-level alerts: set `ALERT_WEBHOOK_URL` **or** `SMTP_HOST`/`SMTP_USER`/`SMTP_TO`/`SMTP_FROM`
   in env (mailer falls through transports when previous isn't configured — `lib/mailer.ts`).
4. Do **not** expose `/api/saas/health` publicly; use only the public `/api/health` for probes.

**Verify:** trigger a monitor pause/down-test or temporarily point at a 5xx to confirm the alert fires.

---

## 4. H9 — Nightly automated backup
> SQLite is a single-file DB; use the **online backup API**, not plain `cp` on a hot file. Restore-test
> daily-scheduled backups — untested backups are not backups (`BACKUP-RECOVERY.md`).
```bash
# Daily online-consistent snapshot + retention (7 daily / 4 weekly / 12 monthly), OFF-machine:
#   Put this in its own Hostinger cron job (e.g. 02:30 daily). Adapt DB path from DATABASE_URL.
MIRROR=/home/u774769673/domains/thebuddharice.online/saas-data          # adjust to actual mirror
BK=/home/u774769673/backups/hospios/$(date +%Y%m%d)
mkdir -p $BK
sqlite3 "$MIRROR/saas.db" ".backup '$BK/app.db.$(date +%Y%m%d-%H%M).db'"
sqlite3 "$BK/app.db.$(date +%Y%m%d-%H%M).db" "PRAGMA integrity_check;"   # expect ok
# nightly - parse the actual DATABASE_URL first:
grep '^DATABASE_URL' /home/u774769673/domains/thebuddharice.online/hbuilds/config/.env
# = short /home/u774769673/backups/hospios/app.db.latest.db  (daily)
# retain: keep 7 daily, 4 weekly-lastofweek, 12 monthly-lastofmonth (script with find -mtime)
```
> Requirements: off-machine retention (different disk / object storage / host snapshot); test **restore**
> to scratch + `PRAGMA integrity_check;` + run smoke against it. Do **not** `cp` the hot DB.
> Back up env/config too (`config/.env`, stored vaulted).

**Verify (first run):** backup file exists, `integrity_check` returns `ok`, and a scratch-restore smoke
passes (`PRODUCTION-SMOKE-PLAYBOOK.md`).

---

## 5. FLAGGED SECURITY ITEM — Remediate demo accounts in production
> Verified: 11 `@hospios.demo` accounts + sessions + one real `ju***@gmail.com` exist in
> `…/hbuilds/current/nodejs/var/data.json`, despite `ALLOW_DEMO_SEED != 1`. `data.json` is **version-tied**
> (lives inside `hbuilds/current/nodejs/`) — a redeploy replaces it, so it is not the canonical store.
> **Verify which file the live app actually reads** before changing anything (do not mutate blindly).

### 5a. Confirm the live store (read-only)
```bash
H=/home/u774769673/domains/thebuddharice.online/hbuilds
node -e "const d=require('$H/current/nodejs/var/data.json'); console.log('users:',d.users&&d.users.length); console.log(d.users.filter(u=>/@hospios\.demo/.test(u.email||'')).map(u=>u.email))"
node -e "const d=require('$H/current/nodejs/var/data.json'); console.log('sessions:',(d.sessions||[]).length)"
```
### 5b. Recommended remediation order
1. **Backup full** `data.json` (cp to the backups dir) before any edit.
2. **Rotate/deactivate demo sessions**: in-app admin (Saas → Settings) or, if a direct JSON edit is
   required, remove those users' sessions in a backup-then-edit flow with the app drained. Prefer the
   in-app admin controls over hand-editing the JSON.
3. **Disable/remove the 11 demo users** through in-app admin (Delete/Deactivate) — do **not** re-seed
   (`npm run seed:*` refuses in prod unless `ALLOW_DEMO_SEED=1`; keep that unset). `demo-credentials.md`.
4. **Investigate the real account** `ju***@gmail.com` — confirm it is a legitimate owner/admin account;
   if not expected, rotate its password and review sessions.
5. **Verify** after change: demo users absent + only expected users remain; `GET /api/health` 200;
   run a quick authed smoke for the remaining real roles.
6. Because `data.json` sits inside the versioned build, confirm the canonical persisted store matches —
   if the app persists user/session data elsewhere (mirror), remediate **there** so it survives redeploys.

### 5c. Guardrails
- Keep `ALLOW_DEMO_SEED` **unset** (≠ "1") in production.
- Never expose/print demo or real passwords; rotate anything shared.
- Do not hand-edit the JSON while the app is actively writing without a drain + backup (`BACKUP-RECOVERY.md`).

---

## 6. Post-provisioning verification checklist
- [ ] `PAYMENT_ENC_KEY` present (≥33 chars) in the env the app + cron read.
- [ ] `CRON_SECRET` + `AFFILIATE_CRON_KEY` present; all 6 cron jobs registered and each ran once → 200; wrong-secret → 401.
- [ ] Uptime monitor on `/api/health` every ≤5 min; 503/non-200 alert fires.
- [ ] Nightly online-consistent backup + retention + first restore-test passed.
- [ ] Demo `@hospios.demo` users removed/deactivated; real account reviewed; sessions rotated.
- [ ] `GET /api/health` 200 `db:up` after every change; release branch head unchanged unless intended.
- [ ] Business sign-offs B1–B5 + owner final launch approval recorded.

## 7. Remaining honest status after this runbook
| Item | Owner runbook section | Status when done |
|------|----------------------|------------------|
| H4 payment key | §1 | OWNER ACTION → COMPLETE (must be set before first provider) |
| H5 cron secrets + wiring | §2 | OWNER ACTION → COMPLETE |
| H8 uptime monitor | §3 | OWNER ACTION → COMPLETE |
| H9 nightly backup (+restore) | §4 | OWNER ACTION → COMPLETE |
| Demo-account security item | §5 | FLAGGED SECURITY ITEM → REMEDIATED |
| P2 `/free-score` 4px trim | (deferred) | P2 POLISH — optional |
