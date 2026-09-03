# HospiOS — SAAS Financial Invariants

> Grounded in the actual implementation (`lib/saas/{gateway,billing,invoices,payments,usageBilling,dunning,coupons,financialApproval}.ts`, `lib/saas/payments/**`, Prisma models).

Financial functionality is treated as a **domain**, not simple CRUD. These are
the invariants that must hold when changing anything financial.

---

## Core invariants

1. **Money ledger is authoritative.** `Payment` is the single source of truth
   for money movement; provider-verified, with `providerPaymentId`, `webhookEventId`,
   `paymentIntentId`, method/masked, fee and idempotency key.

2. **Idempotency is enforced.** Invoices and payments carry an
   `idempotencyKey` (`@unique`). The gateway checks for an existing record with
   the supplied key before creating — a caller-supplied key means "this exact
   logical operation", and re-delivery must return the original result, never a
   duplicate debit.

3. **All commercial money movement goes through the gateway.** The gateway
   orchestrator (`lib/saas/gateway.ts`) is the mandatory path for invoice and
   payment creation. It integrates coupons, writes immutable audit, runs
   transactionally and rolls back on error. Do not call provider adapters
   directly from business code.

4. **Explicit state transitions.** Subscription and invoice status machines
   define valid transitions (e.g. `Subscription`: trial → active →
   past_due/grace → suspended → cancelled/expired/paused). Never jump states
   arbitrarily.

5. **Concurrency protection.** `Plan.version` is a concurrency counter;
   financial decisions take snapshots for deterministic approval. Do not
   silently drop concurrency handling.

6. **Currency accuracy.**
   - Amounts are stored in minor units (cents) at the ledger level.
   - `PlanCountryPrice` localizes storefront pricing; the documented invariant
     is **US ×100 == Plan cents**.
   - `Subscription.unitAmount` is in charged-currency units; `mrr`/`amount` in
     USD cents by convention.
   - `Payment` and `Invoice` each carry `currency`.
   - `FinancialApproval`/`AffiliatePayout`/`FranchisePayout` carry explicit
     amounts/currency for auditability.

7. **Auditability.** Every financial mutation writes an immutable audit record
   (`AuditLog`) including before/after snapshots, actor, IP and request id.

8. **High-risk actions require four-eyes approval.** `FinancialApproval`
   guards invoice void, payment refund, and payout release. It stores an
   immutable requested-state snapshot with amount/currency and requester +
   reviewer. Do not bypass it.

---

## Payment flow

```text
Plan → Subscription → Invoice → Payment → Settlement → Dunning / Renewal
```

The payment layer is provider-neutral:

```text
Payment Request
  → Provider Resolver (routing: currency, amount, capability, health)
  → Provider Adapter (stripe/razorpay/…)
  → External Gateway
  → Webhook / Callback (verification)
  → Canonical Payment State + ledger row
```

Key modules: `lib/saas/payments/{catalog,capabilityMatrix,validate,routing,intents,crypto,reconcile,health,helpers,errors,store}.ts`, `lib/saas/adapters/*`, `lib/saas/payments/adapter.ts` (`BasePaymentAdapter`).

---

## Metered / usage billing

- `UsageRecord` keys metered usage per org/metric/period (`YYYY-MM`).
- `usageBilling.ts` converts metered usage into invoice line items / overages;
  `usage.ts` handles ingestion, deduplication and windowed aggregation.
- Cron recalculation: `/api/saas/cron/usage`.

---

## Dunning / recovery

- `DunningCase` tracks a failed-payment retry workflow (attempt, maxAttempts,
  nextRetryAt, status: active/recovered/suspended/given_up).
- Cron: `/api/saas/cron/dunning`.

---

## Coupons

- `Coupon` (percent bps / fixed cents; once/repeating/forever; maxRedemptions,
  expiresAt, planId) and `CouponRedemption` records amount discounted and
  times applied.
- Applied through the gateway (`applyCoupon`); `couponMode` distinguishes
  `"new"` vs `"renewal"` so repeating/forever coupons re-apply on renewal.

---

## Related financial domains

- **Refunds / voids**: invoice void and refunds are `FinancialApproval`-gated.
- **Commissions & payouts**: `AffiliateCommission` + `AffiliatePayout` and
  `FranchisePayout` carry amounts/currency/status; payout release is
  approval-gated and cleared by `/api/saas/payouts/settle` and
  `/api/saas/cron/affiliate-recurring`.

---

## Testing / safety

Financial, security and tenancy changes require extra focused tests. Never
lower the invariants above for expediency; if a rule needs to change, it
requires explicit owner approval, not a developer guess.
