-- Phase H: customer Subscription Self-Service.
-- 1) End-of-period (scheduled) cancellation: a subscription flagged
--    cancelAtPeriodEnd stays in its current revenue state until
--    currentPeriodEnd, then transitions to cancelled. Resume clears the flag.
-- 2) PlanChangeRequest gains a customer subscription-switch mode
--    (action="subscription_change"): rows carry subscriptionId/organizationId/
--    fromPlanId/toPlanId/billingCycle, are created by an org contact (customer),
--    approved/rejected by a billing admin (SUBSCRIPTION_MANAGE), and on approve
--    execute the canonical changePlan() against the target subscription.
--    Existing plan-CATALOG proposal rows keep the new columns NULL.
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanChangeRequest" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "PlanChangeRequest" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "PlanChangeRequest" ADD COLUMN "fromPlanId" TEXT;
ALTER TABLE "PlanChangeRequest" ADD COLUMN "toPlanId" TEXT;
ALTER TABLE "PlanChangeRequest" ADD COLUMN "billingCycle" TEXT;
CREATE INDEX "PlanChangeRequest_subscriptionId_status_idx" ON "PlanChangeRequest"("subscriptionId", "status");
CREATE INDEX "PlanChangeRequest_organizationId_status_idx" ON "PlanChangeRequest"("organizationId", "status");
