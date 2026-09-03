# Contributing to HospiOS

Thank you for contributing. This guide covers how to work in this repository
safely — especially because it contains a **SaaS Control Plane** (billing,
payments, subscriptions, affiliates, RBAC) where mistakes are expensive.

HospiOS is a Next.js (App Router) + TypeScript + Prisma application.

---

## Repository scope

This repository contains:

- **Marketing Website** — public pages (`app/about`, `app/platform`, `app/pricing`, `app/solutions`, `app/blog`, …)
- **Growth / Lead Generation** — `app/demo`, `app/free-score`, `app/score-check`, `app/marketing-admin`
- **Property Intelligence** — scoring, reviews, reports, claims
- **SaaS Control Plane** — `app/saas`, `app/partner`, `app/affiliate`, `app/customer`, `app/dashboard`, `app/subadmin`, `app/staff`, `lib/saas`, `app/api/saas`

The **main operational PMS application** is deliberately out of scope for this
repository's architecture. If you touch a PMS integration, document only the
interface/dependency this SaaS layer needs.

---

## Getting started

```bash
npm install          # runs prisma generate + runtime fix automatically
npm run dev          # start dev server
```

Environment: use `.env`, `.env.local`, or `.env.production` for local/host
configuration. Only non-secret placeholders belong in `.env.example`.

Prisma client is generated under `lib/generated/prisma`. Do not commit
generated output changes that are unrelated to your work.

---

## Where code belongs

| Concern | Location |
|---|---|
| Page / route UI | `app/<route>/page.tsx` |
| Marketing pages | `app/*` (public) and `components/marketing/*` |
| SaaS admin UI | `app/saas/**`, `app/marketing-admin/**`, `app/partner/**`, `app/affiliate/**` |
| Customer portal | `app/customer/**` |
| API route handlers | `app/api/**/route.ts` |
| SaaS service/domain logic | `lib/saas/**` |
| Payment providers | `lib/saas/payments/**`, `lib/saas/adapters/**`, `lib/providers/**` |
| RBAC | `lib/rbac.ts`, `lib/saas/roles.ts`, `lib/marketing/roles.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/**` |
| Tests | colocated `*.test.ts` next to the module under `lib/**` |
| Scripts | `scripts/**` |

**Do not put business logic in presentation components when a domain/service
layer already exists.** Locate the canonical service before changing a domain.

---

## Quality gates

Before a PR is ready:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npx vitest run      # unit tests
npm run build       # prisma generate + next build
npm run launch:check
npm run smoke
```

Financial, security and tenancy changes require additional focused tests.

---

## Database & migrations

- Schema lives in `prisma/schema.prisma` (SQLite today, Prisma-backed).
- **Never run `prisma db push` against production.**
- Schema changes go through a versioned migration:

```text
edit schema → prisma migrate dev --name <your_change>
→ local validation → migration review → deploy (prisma migrate deploy)
```

- Migrations must be additive and reviewable unless a destructive migration is
  explicitly approved.
- `Plan` carries a `version` concurrency counter — change it intentionally.

---

## Financial changes

Financial functionality is a domain, not CRUD. Before changing anything in
`lib/saas/billing.ts`, `lib/saas/payments.ts`, `lib/saas/gateway.ts`,
`lib/saas/invoices.ts`, `lib/saas/dunning.ts`, `lib/saas/coupons.ts`, or
`lib/saas/usageBilling.ts`:

1. Preserve transactional writes.
2. Preserve idempotency keys (invoices, payments).
3. Preserve explicit state transitions.
4. Preserve auditability.
5. Keep currency handling in minor units / local units per the documented
   invariants (`PlanCountryPrice` US ×100 == Plan cents).
6. Route payments through the gateway orchestrator, not provider adapters
   directly.

High-value actions (`invoice void`, `payment refund`, `payout release`) go
through `FinancialApproval` — do not bypass it.

---

## Payment changes

Payments are provider-neutral. Never let provider-specific logic leak into the
rest of the domain.

- Create/extend a `BasePaymentAdapter` for a provider (`lib/saas/adapters/*`).
- Register provider defaults in `lib/saas/payments/catalog.ts`.
- Capabilities live in `lib/saas/payments/capabilityMatrix.ts`.
- Live provider activation is **explicitly controlled**: toggling a provider to
  `mode: "live"` requires a `confirmLiveActivation` acknowledgment persisted in
  `SystemSetting("payment_providers")`. Do not bypass it.
- Never claim a provider is `LIVE` in docs unless it is actually activated.

---

## RBAC & tenancy changes

- UI-level hiding is **not** a security boundary.
- Every protected mutation must enforce: Authentication → Authorization →
  Tenant Scope → Validation → Business Rules → Database.
- A request must not escape its permitted organization/property context.
- Client-provided IDs must never be treated as trusted ownership.
- Merge-layer roles live in `lib/rbac.ts`; SaaS roles/permissions in
  `lib/saas/roles.ts`; marketing roles in `lib/marketing/roles.ts`.

When changing roles or permissions, update `docs/SAAS-RBAC-MATRIX.md` to match.

---

## Security rules

Never commit:

- passwords, API keys, private keys
- payment credentials, encryption keys
- production database credentials
- webhook secrets, session secrets

Add only safe placeholders to `.env.example`. Keep production secrets out of
GitHub — use environment/managed secrets on the host.

---

## Branching & pull requests

- Create a branch/PR per logical change.
- Keep PRs small and reviewable.
- A good PR states: what changed, why, files/domains affected, security impact,
  database impact, migration impact, tests, deployment considerations, and
  backward compatibility.

```text
main (protected, via PR/review)
  └─ feature/<scope>-<short-description>
```

PR and review rules on the protected branch are intentional — do not bypass
them even under time pressure.
