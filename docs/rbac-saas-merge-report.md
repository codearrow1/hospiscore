# RBAC / SaaS Merge — Final Implementation Report

Date: 2026-08-21 · Branch: `main` · Commits: `5c7797c` + end-to-end completion pass

## Verification summary (all executed live, not assumed)

| Check | Result |
| --- | --- |
| Logins (superadmin, subadmin, affiliate, partner, customer, customer2, staff) | 7/7 → 200; bad password → 401 |
| `/dashboard` role routing | 7/7 redirect to correct dashboard |
| Cross-role direct URL access | affiliate/customer→`/subadmin` 307; partner→`/staff` 307; customer2→`/partner` 307; staff→`/customer` 307 |
| Subadmin marketing read/write | GET leads 200; POST lead 201 (legitimate functions preserved) |
| Subadmin SaaS writes | org create 403 `CUSTOMER_MANAGE required`; plan create 403 `PLAN_MANAGE required` |
| Subadmin SaaS read visibility | GET organizations 200 (CUSTOMER_VIEW) |
| Staff support read | 200 (after `requireSaasAccess` fix) |
| Staff privileged ops | plans/payments POST → 403 |
| Portal roles on admin APIs | affiliates/partners/support/subscriptions/metrics → 403 |
| Customer A/B isolation | A sees only "Demo Grand Hotel"; B sees only "Demo Grand Resort" (API-level) |
| Self-scoped APIs | partner sees only own code/commissions; affiliate only AFFDEMO01; no client-supplied IDs accepted (structural tests) |
| Financial integrity | MRR consistent 10/10 orgs; paid invoices = succeeded payments (8 = 8, $1,692.00); commissions $591.55 vs payouts $144.60 internally consistent |

## Issues found by verification and fixed in this pass

1. **SaaS-only roles locked out of SaaS APIs** — every `/api/saas/*` route gated on
   `requireMarketingUser()`, so `support_admin`/`finance_admin` etc. got 403 despite
   holding the right `hasSaasPerm`. Fixed with new `requireSaasAccess()` guard
   (`lib/marketing/guard.ts`) applied to all 37 SaaS route files. Permission checks
   remain per-route via `hasSaasPerm`; portal identities still rejected ("SaaS access required").
2. **Seeder financial inconsistency** — demo orgs had cached `mrr=0` and paid invoices
   without Payment rows. Seeder now calls `syncOrgMrr()` (existing business logic) per
   subscription and creates matching succeeded `Payment` records; `ensurePortalIdentities`
   self-heals stale portal-org MRR on every run.
3. **Wrong-role portal access was a soft page** — `/partner`, `/customer` now hard-redirect
   non-members to `/account?next=…` (super admin keeps the explanatory empty state).
4. **Missing role sidebars** — added permission-aware `components/portal/PortalNav.tsx`;
   rendered on all five portals; links generated from canonical role only.

## Sidebars/navigation

- Super Admin → full SaaS control-plane nav (permission-filtered shell, existing).
- Subadmin → Dashboard / Leads / Campaigns / Pipeline / Analytics / Profile.
- Affiliate → Dashboard / Commissions / Payouts / Profile.
- Partner → Dashboard / Referrals / Commissions / Payouts / Profile.
- Customer → Dashboard / Subscription / Usage / Billing / Profile.
- Staff → Queue / Profile.
All nav items point at routes the backend enforces; nothing render-only.

## Backend RBAC audit result

All 33 SaaS API routes guarded (auth + `hasSaasPerm`); all marketing APIs use
`requireCapability`; remaining public routes are public-by-design (auth, search,
pricing, tracking pixels, public forms). No endpoint relies on frontend-only protection.
Portal APIs accept no client-supplied identity parameters (IDOR-safe by construction;
verified live + structural guard-rail tests).

## Tests

`npx tsc --noEmit` clean · `npm run lint` clean · `npm test` **222/222** (baseline 205 +
17 RBAC/auth/isolation tests) · `npm run build` success. Live matrix above executed
against a running dev server with real cookie sessions.

## Known remaining issues (non-critical)

- Granular SaaS owner roles (finance_admin, …) route to `/saas` but keep narrow perms — intentional.
- Affiliate portal keeps its pre-existing soft "no account found" page for non-affiliates.
- Demo seeding remains production-blocked by design (`ALLOW_DEMO_SEED` guard).

## Files changed in completion pass

`lib/marketing/guard.ts` (+requireSaasAccess), 37 × `app/api/saas/**/route.ts`
(guard swap), `components/portal/PortalNav.tsx` (new), 5 portal pages (nav + anchors +
hard redirects), `scripts/seed-demo-month.ts` (payments + MRR sync),
`lib/marketing/seed.ts` (customer2 + self-healing MRR), `lib/rbac.test.ts`
(+staff boundary, +credential auth, +IDOR guard-rail tests), `lib/marketing.test.ts`
(count 11), docs updated.

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
- `npm test` — **222/222 pass** (incl. RBAC, credential-auth and IDOR guard-rail tests in `lib/rbac.test.ts`)
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
