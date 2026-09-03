# HospiOS — SaaS Management Architecture

> Grounded in the actual codebase as inspected (Prisma schema + `lib/saas/**`).

## Purpose

The SaaS Control Plane is the commercial and administrative core of HospiOS.
It manages organizations, properties, users/RBAC, plans, subscriptions,
billing, payments, affiliates, partners, franchise, analytics, settings,
audit, integrations and platform administration — around (but not inside) the
operational PMS.

---

## Tenant hierarchy

```text
Platform
   ↓
Organization   ← primary tenant
   ↓
Property
   ↓
Membership / Users / Business Data
```

`Organization` is the tenant hub. `Property` links an organization to a Google
Place (`placeId`, unique) and an external PMS (`pmsInstanceUrl`).

---

## Data model (grounded)

The Prisma schema (`prisma/schema.prisma`) contains **46 models** (SQLite
provider; no database enums — controlled vocabularies are `String` with
comment-documented values).

### SaaS core

| Model | Purpose |
|---|---|
| `Organization` | Primary tenant; owns subscriptions, billing, claims, health/mrr signals |
| `OrgContact` | Contacts (owner/billing/tech) on an organization |
| `Plan` | Plan catalog entry; `marketingPlanId` links to marketing pricing; `version` concurrency counter |
| `PlanCountryPrice` | Localized price per plan/country (invariant: US ×100 == Plan cents) |
| `PlanChangeRequest` | Super-admin decision record for plan/subscription changes (JSON snapshots) |
| `SystemSetting` | Platform key/value config; hosts `payment_providers`, financial controls, portal bindings |
| `FeatureFlag` | Feature gates scoped by plan/org/property/country/percentage/beta |

### Subscriptions & billing

| Model | Purpose |
|---|---|
| `Subscription` | Billing state machine (trial → active → … → cancelled/expired/paused) |
| `Invoice` | Document per org/subscription; idempotency key |
| `Payment` | Money ledger — single source of truth, provider-verified |
| `PaymentIntent` | Transient checkout/intent (not a ledger row) |
| `PaymentWebhookLog` | Append-only webhook event log (replay + audit) |
| `PaymentProviderHealth` | Per-provider health ledger |
| `UsageRecord` | Metered usage per org/metric/period |
| `DunningCase` | Failed-payment retry / collections state |
| `Coupon` / `CouponRedemption` | Discount definitions + redemption records |
| `FinancialApproval` | Four-eyes approval for invoice void / refund / payout release |

### Affiliates / partners / franchise

| Model | Purpose |
|---|---|
| `Affiliate` (and 15 related models) | Affiliate account + tree, clicks, campaigns, commissions, payouts, attribution, recruitment, tiers, applications, fraud cases, agreements, assets, notifications, settings |
| `Partner` | Reseller/consultant with commission model |
| `Franchisee`, `FranchiseTerritory`, `FranchisePayout` | Franchise revenue-share domain |

### Property intelligence (SaaS-side)

| Model | Purpose |
|---|---|
| `Property` | Tenant property linked to a Google `placeId` and external `pmsInstanceUrl` |
| `PropertyClaim` | Owner claim of a Google listing with verification workflow |

### Ops / users / audit

| Model | Purpose |
|---|---|
| `AuditLog` | Append-only platform audit trail |
| `SupportTicket`, `TicketComment` | Support with SLA tracking |
| `Notification` | In-app/user notifications |
| `OnboardingProgress` | Portal "mark done" checklist state |
| `UserPreference` | Per-user timezone/date formatting |

> **Note:** there are no dedicated `User`/`Role`/`Permission`/`Membership`
> tables. Users are referenced by email/id and roles are handled by app logic
> (`lib/rbac.ts`, `lib/saas/roles.ts`). There are also **no** `Lead`/`Report`/
> `Demo` tables — those live in the marketing DataFile and are referenced via
> `AffiliateCommission.leadId`. There is **no** operational PMS domain in the
> schema (external via `Property.pmsInstanceUrl`).

---

## Domain/service layer (`lib/saas/**`)

| Area | Modules |
|---|---|
| Bootstrapping | `init.ts`, `dbUrl.ts`, `enginePath.ts` |
| Organizations & plans | `organizations.ts`, `plans.ts`, `planCatalog.ts`, `planSync.ts`, `pricingSync.ts`, `subscriptionPlan.ts` |
| Subscriptions | `subscriptions.ts`, `customerSubscription.ts`, `lifecycle.ts`, `demoMonth.ts`, `onboarding.ts`, `entitlements.ts` |
| Billing & usage | `billing.ts`, `invoices.ts`, `usage.ts`, `usageBilling.ts`, `dunning.ts`, `coupons.ts` |
| Payments | `payments.ts`, `gateway.ts`, `financialApproval.ts`, plus `payments/**` (types, adapter, factory, catalog, capabilityMatrix, intents, validate, routing, store, reconcile, helpers, errors, crypto, health) |
| Affiliates / growth | `affiliates.ts`, `commissions.ts`, `recurringCommissions.ts`, `payouts.ts`, `payoutEngine.ts`, `attribution.ts`, `multiTier.ts`, `campaigns.ts`, `partners.ts`, `search.ts` |
| Franchise | `franchise.ts`, `franchisePayouts.ts` |
| Property SaaS | `properties.ts`, `propertyClaims.ts`, `propertyVerification.ts`, `propertyDiscovery.ts`, `propertyImport.ts` |
| Trust / ops | `fraud.ts`, `audit.ts`, `roles.ts`, `notifications.ts`, `settings.ts`, `support.ts`, `ticketRules.ts`, `portalLinks.ts`, `portalAccess.ts`, `analytics.ts`, `metrics.ts`, `health.ts`, `automation.ts`, `cronAuth.ts` |

### Payment flow responsibilities

The gateway orchestrator (`lib/saas/gateway.ts`) is the **mandatory** path for
invoice/payment creation. It handles routing to provider adapters, coupons,
audit, transactions and error rollback. Provider-specific logic must stay in
`lib/saas/adapters/*` and never leak into the rest of the domain. See
`docs/SAAS-FINANCIAL-INVARIANTS.md` and `docs/SAAS-INTEGRATIONS.md`.

---

## Authorization flow

```text
Authentication
   ↓
Authorization (RBAC)
   ↓
Tenant Scope (org/property)
   ↓
Validation
   ↓
Business Rules
   ↓
Database
```

UI hiding is never a security boundary. See `docs/SAAS-RBAC-MATRIX.md`.
