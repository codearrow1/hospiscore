# HospiOS — Deployment

> Production deployment contract: **`docs/HOSTINGER-DEPLOYMENT-CONTRACT.md`**
> (repository-side contract with host-side verification items).
> This file summarizes the deployment approach and the boundaries around it.

## Stack

- Next.js (App Router, Next 15) + Node.js + Prisma.
- Repository hosting: **GitHub** (`github.com/codearrow1/hospiscore`).
- Production host: **Hostinger** — domain `https://thebuddharice.online`.
- Persistence: Prisma-backed (SQLite config today, `DATABASE_URL` managed).

## Scripts (grounded in `package.json`)

| Script | Purpose |
|---|---|
| `npm run build` | `prisma generate && node scripts/fix-prisma-runtime.mjs && next build` |
| `npm start` | `prisma migrate deploy && next start` |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run postinstall` | `prisma generate && node scripts/fix-prisma-runtime.mjs` |
| `npm run launch:check` | launch diagnostics |
| `npm run smoke` | smoke checks |

`scripts/fix-prisma-runtime.mjs` maps the Prisma query-engine runtime to
`library.js` to avoid Node bundling failures on hPanel — it runs in
`postinstall` and `build`. Do not remove it.

## Deploy flow

```text
commit → push to GitHub branch
  → on Hostinger: git pull <release-branch>
  → npm install (runs postinstall)
  → npx prisma generate
  → npm run db:migrate  (prisma migrate deploy)
  → npm run build
  → restart the app process (pm2 / host manager)
  → live verification
```

**Never** run `prisma db push` against production. Use versioned migrations.

## Environment & secrets

- Use `.env`, `.env.local`, `.env.production` for local/host config; add only
  safe placeholders to `.env.example`.
- Keep production secrets out of GitHub: DB credentials, payment credentials,
  webhook secrets, session/encryption keys live in the host's environment
  manager, not in the repository.

## Boundaries

- Production secrets are not stored in the repo; the exact deployment contract
  belongs in deployment docs (`docs/HOSTINGER-DEPLOYMENT-CONTRACT.md`), not in
  application code.
- The main operational PMS application is out of scope for this repository; a
  PMS integration appears only as a dependency interface of this SaaS layer.
