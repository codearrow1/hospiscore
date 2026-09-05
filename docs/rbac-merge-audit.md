# RBAC / SaaS Merge — Implementation Audit

Written **before** coding (per merge spec §1). Every claim verified from the codebase on 2026-08-21.

## 1. Architecture discovered

| Layer | Reality |
| --- | --- |
| Frontend | Next.js 15.5.21 App Router, React 19, Tailwind v4, server components |
| Backend | Next.js route handlers (`app/api/**`), Node runtime |
| Database #1 | JSON `DataFile` (`lib/db.ts`) → `~/.hospiscore/data.json` — marketing CRM, users, sessions, pricing |
| Database #2 | Prisma 6 + SQLite `var/saas.db` (`prisma/schema.prisma`, 23 models) — SaaS plane |
| Auth | Email/password, scrypt hashes (`lib/auth.ts`), session cookie (`lib/sessionCookie.ts`), login at `/account` via `/api/auth/login` |
| Marketing RBAC | `lib/marketing/roles.ts` — 8 roles × 12 capabilities, guard `hasCapability`/`canAccess` |
| SaaS RBAC | `lib/saas/roles.ts` — 17 roles × 28 permissions, guard `hasSaasPerm`; legacy marketing roles mapped in |
| Entry points | Marketing admin `/marketing-admin/*`, SaaS control plane `/saas/*`, affiliate portal `/affiliate` |

## 2. Existing roles (definitive, from code)

Marketing roles (`AuthUser.role`, JSON plane): `super_admin`, `marketing_admin`, `marketing_manager`,
`sales_manager`, `sales_rep`, `content_editor`, `seo_manager`, `analyst`. Plus implicit super admin via
`ADMIN_EMAILS` allowlist fallback.

SaaS-only role strings: `platform_admin`, `finance_admin`, `customer_success`, `support_admin`,
`affiliate_manager`, `partner_manager`, `franchise_manager`, `read_only`.

Portal identities are **not** roles today — they are rows in Prisma keyed by email:
`Affiliate` (email unique), `Partner` (email unique), customer = primary `OrgContact` on an `Organization`.

## 3. Existing users

Seeded dev-only demo users (`lib/marketing/seed.ts`, production-guarded):
superadmin@hospios.demo, marketing@hospios.demo, salesmanager@hospios.demo, sales@hospios.demo,
content@hospios.demo, analyst@hospios.demo. No partner/customer/staff/affiliate portal users exist.

## 4. Overlaps / conflicts found

1. `marketing_admin` currently holds **write** SaaS perms (`SUBSCRIPTION_MANAGE`, `BILLING_MANAGE`,
   `CUSTOMER_MANAGE`, `PLAN_MANAGE`) — violates the target "Subadmin cannot touch Super-Admin SaaS controls".
2. Two role systems (marketing capabilities vs SaaS permissions) with different vocabularies.
3. No canonical top-level hierarchy; dashboards are per-module, not per-role.
4. No `/dashboard` router; no partner/customer/staff portals.

## 5. Migration decision

- Users live in the JSON plane and keep their IDs/hashes/history — **no destructive changes**.
- Legacy marketing-admin variants map to canonical `SUBADMIN`; `super_admin`/`platform_admin` (+ ADMIN_EMAILS)
  map to `SUPER_ADMIN`; `support_admin`/`customer_success` map to `STAFF`.
- Affiliate/Partner/Customer identity resolved from Prisma rows by email/userId (existing pattern used by
  `/affiliate`) — no schema change required for the merge itself.
- SaaS write permissions stripped from subadmin-tier roles at the **API layer** (`ROLE_SAAS_PERMS`), not just UI.

## 6. Plan

New `lib/rbac.ts` (canonical roles + resolver + dashboard paths) → tighten `lib/saas/roles.ts` →
`/dashboard` router → role dashboards (`/subadmin`, `/partner`, `/customer`, `/staff`; reuse existing
`/saas`, `/affiliate`) → self-scoped APIs (`/api/partner/me`, `/api/customer/me`) → seed users +
portal identities → one-month demo seeder → tests → docs.
