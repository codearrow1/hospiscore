# Demo Credentials (DEVELOPMENT ONLY)

> These accounts are seeded by `npm run seed:marketing-demo` (users) and
> `npm run seed:demo-month` (users + one month of demo data). Seeding is
> **refused in production** unless `ALLOW_DEMO_SEED=1` is explicitly set.
> Never reuse these passwords outside a local/demo environment.

Login URL for all roles: `/account` (or `/dashboard` after signing in — it routes by role).

| Role | Email | Password | Dashboard | Scope |
| --- | --- | --- | --- | --- |
| Super Admin | `superadmin@hospios.demo` | `Hospios@Demo2026!` | `/saas` | Full SaaS control plane: tenants, subscriptions, plans, billing, affiliates, partners, franchise, settings, audit |
| Subadmin (Marketing Admin) | `marketing@hospios.demo` | `Marketing@Demo2026!` | `/subadmin` | Marketing/operations: leads, campaigns, content, analytics; read-only customer/billing visibility; **no SaaS write access** |
| Sales Manager (Subadmin tier) | `salesmanager@hospios.demo` | `Sales@Demo2026!` | `/subadmin` | Leads pipeline + assignment |
| Sales Rep (Subadmin tier) | `sales@hospios.demo` | `SalesRep@Demo2026!` | `/subadmin` | Assigned leads/demos only |
| Content Editor (Subadmin tier) | `content@hospios.demo` | `Content@Demo2026!` | `/subadmin` | Website content only |
| Analyst (Subadmin tier) | `analyst@hospios.demo` | `Analytics@Demo2026!` | `/subadmin` | Read-only reporting |
| Affiliate | `affiliate@hospios.demo` | `Affiliate@Demo2026!` | `/affiliate` | Own referrals/clicks/commissions/payouts only (code `AFFDEMO01`) |
| Partner | `partner@hospios.demo` | `Partner@Demo2026!` | `/partner` | Own referred accounts/commissions/payouts only (code `PTNDEMO01`) |
| Customer | `customer@hospios.demo` | `Customer@Demo2026!` | `/customer` | Own organization only ("Demo Grand Hotel"): subscription, usage, invoices |
| Customer B | `customer2@hospios.demo` | `Customer2@Demo2026!` | `/customer` | Own organization only ("Demo Grand Resort") — used for cross-customer isolation testing |
| Staff (Support) | `staff@hospios.demo` | `Staff@Demo2026!` | `/staff` | Support ticket queue (SUPPORT_VIEW/MANAGE) |

## Environment assumptions

- Local dev (`NODE_ENV=development`) with the JSON store at `~/.hospiscore/data.json`
  and SQLite at `DATABASE_URL` (local default `file:C:/Temp/saas.db`; production sets its own).
- Demo seeding is idempotent — re-running never duplicates.

## Commands

```bash
# Create/refresh demo users + portal identities
npm run seed:marketing-demo

# Users + one month of realistic demo data (leads, orgs, subs, invoices,
# usage, tickets, clicks, commissions). Skips if already seeded.
npm run seed:demo-month

# Reset: wipe demo-month SaaS rows + demo leads, then reseed
npx tsx scripts/reset-demo-month.ts   # see report §18
```

## Production note

Do **not** set `ALLOW_DEMO_SEED=1` in production. If demo accounts must exist on
the public site, create real users via `/api/auth/register` and assign roles
through the admin instead.
