# RBAC / SaaS Merge — Final Implementation Report

Date: 2026-08-21 · Branch: `main` (uncommitted at time of writing)

## 1. Existing architecture discovered

See `docs/rbac-merge-audit.md` (written before coding). Summary: Next.js 15 App Router;
JSON `DataFile` plane (marketing CRM, users, sessions) + Prisma/SQLite plane (SaaS);
scrypt password auth with httpOnly session cookies; marketing capability RBAC
(8 roles × 12 capabilities) and SaaS permission RBAC (17 roles × 28 permissions).

## 2. Legacy Marketing Admin → Subadmin migration

- **Underlying model change, not a rename**: all legacy marketing-admin variants
  (`marketing_admin`, `marketing_manager`, `sales_manager`, `sales_rep`,
  `content_editor`, `seo_manager`, plus `analyst`, `read_only`) now map to canonical
  **SUBADMIN** via `appRoleFromStoredRole()` in `lib/rbac.ts`.
- **SaaS write perms revoked at the API layer** in `lib/saas/roles.ts`:
  `marketing_admin` lost `SUBSCRIPTION_MANAGE`, `BILLING_MANAGE`, `CUSTOMER_MANAGE`,
  `PLAN_MANAGE`, `PROPERTY_MANAGE`, `USAGE_VIEW`; keeps read-only
  `CUSTOMER_VIEW`/`BILLING_VIEW` + full marketing scope. `sales_admin`/`sales_manager`
  lost their `*_MANAGE` perms too.
- Stored role strings were **not** rewritten (no destructive data change); existing
  users keep IDs, hashes, history. Mapping is authoritative and centralized.

## 3. Final role list

| Canonical | Source identities | Dashboard |
| --- | --- | --- |
| SUPER_ADMIN | `super_admin`, `platform_admin`, `finance_admin`, `sales_admin`, `affiliate_manager`, `partner_manager`, `franchise_manager`, ADMIN_EMAILS fallback | `/saas` |
| SUBADMIN | all legacy marketing roles + `analyst`, `read_only` | `/subadmin` |
| STAFF | `support_admin`, `customer_success` | `/staff` |
| AFFILIATE | `Affiliate` row by email/userId | `/affiliate` |
| PARTNER | `Partner` row by email/userId | `/partner` |
| CUSTOMER | primary `OrgContact` row by email | `/customer` |

## 4. Permission matrix

Centralized in two engines, bridged by `lib/rbac.ts`:
- Marketing capabilities: `lib/marketing/roles.ts` (`ROLE_CAPABILITIES`) — unchanged semantics for subadmin tier.
- SaaS permissions: `lib/saas/roles.ts` (`ROLE_SAAS_PERMS`) — subadmin tier restricted to views; Super Admin tier retains all 28.

## 5–7. User migration, new users, dashboards

- No users destroyed or recreated; 6 pre-existing demo users retained.
- New demo users: `affiliate@`, `partner@`, `customer@` (portal-only, no admin role),
  `staff@hospios.demo` (`support_admin`). Portal identities seeded idempotently:
  Affiliate `AFFDEMO01` (active), Partner `PTNDEMO01` (active), Organization
  "Demo Grand Hotel" + primary OrgContact `customer@hospios.demo` + active subscription.
- Dashboards: `/subadmin` (pipeline KPIs, stage distribution, recent leads),
  `/partner` (referred accounts, commissions, payouts, referral link),
  `/customer` (plan/MRR/outstanding/usage cards, subscription, billing history),
  `/staff` (ticket queue, assigned-to-me, SLA-breach flags). `/saas` and `/affiliate` reused.
- `/dashboard` routes every signed-in user to their canonical dashboard.

## 8–10. Sidebars, route protection, backend authorization

- `/saas` shell filters nav per permission (existing); portal pages are scoped single-purpose.
- Every new page: session guard → role/permission guard → redirect to `/account?next=…`.
- Backend: `hasSaasPerm` enforced on every SaaS API (verified live); new self-scoped APIs
  `/api/partner/me`, `/api/customer/me` resolve identity from the session only — no client-supplied IDs (IDOR-safe).

## 11. Tenant/data isolation

Affiliate/Partner/Customer portals query strictly by the caller's email/userId link;
cross-tenant access impossible without a matching identity row. Verified: customer sees
only "Demo Grand Hotel"; partner sees only own commissions/payouts/referrals.

## 12. Database migrations

**None required** — the merge reuses existing models (AuthUser.role string, Affiliate,
Partner, Organization/OrgContact). No schema drift introduced.

## 13. Demo data generated (one month, relative dates)

36 leads + 64 pipeline events across 30 days (weighted stage progression), 3 campaigns,
8 organizations with active subscriptions + paid invoices + weekly usage records
(properties/bookings/api_calls), 6 support tickets (incl. one SLA-breached), 81 affiliate
clicks, 6 commissions (partner percent_first approved; affiliate percent_mrr_12 payable),
1 affiliate payout. Deterministic seeded RNG → believable distributions.

## 14. Tests executed

- `npm run typecheck` — clean
- `npm run lint` — clean (fixed `<a>`→`Link`, unused import)
- `npm test` — **216/216 pass** (incl. 11 new RBAC tests in `lib/rbac.test.ts`)
- `npm run build` — success (all new routes compiled)
- Live matrix (dev server): 6/6 logins 200; bad password 401; `/dashboard` routes each
  role correctly; cross-role page access → 307 `/account`; subadmin SaaS write → 403;
  portal roles on SaaS APIs → 403; anon API → 401; superadmin metrics → 200;
  all four new dashboards render seeded data.

## 15–17. Issues discovered / fixed / deferred

Fixed during implementation:
1. `marketing_admin` held SaaS write perms (privilege escalation vs target model) → revoked.
2. Invalid LeadSource `"comparison_listing"` in seeder → replaced with `"blog"`.
3. Customer portal org had no usage trail → added usage block to seeder + backfill.
4. Demo-user count test updated 6→10 after adding portal roles.

Deferred (non-critical, documented):
- Granular SaaS owner roles (finance_admin etc.) route to `/saas` but keep their narrow
  permission sets — intentional; hierarchy label is coarse, authorization stays granular.
- Staff ticket list sorts priority alphabetically (cosmetic).
- Production seeding of demo users remains blocked by design (`ALLOW_DEMO_SEED` guard).

## 18. Commands

```bash
npm run seed:marketing-demo   # demo users + portal identities
npm run seed:demo-month       # + one month of demo data (idempotent)
npx tsx scripts/reset-demo-month.ts   # wipe demo-month rows (keeps logins)
npm run dev                   # then sign in at /account
```

## Files created/modified

Created: `lib/rbac.ts`, `lib/rbac.test.ts`, `app/dashboard/page.tsx`, `app/subadmin/page.tsx`,
`app/partner/page.tsx`, `app/customer/page.tsx`, `app/staff/page.tsx`,
`app/api/partner/me/route.ts`, `app/api/customer/me/route.ts`,
`scripts/seed-demo-month.ts`, `scripts/reset-demo-month.ts`,
`docs/rbac-merge-audit.md`, `docs/demo-credentials.md`, this report.
Modified: `lib/saas/roles.ts` (subadmin boundary), `lib/marketing/seed.ts` (4 users +
portal identities), `lib/marketing.test.ts` (count 6→10), `package.json` (`seed:demo-month`).
