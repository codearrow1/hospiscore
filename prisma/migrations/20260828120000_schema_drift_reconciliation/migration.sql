-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'created',
    "idempotencyKey" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "clientToken" TEXT,
    "method" TEXT,
    "methodMasked" TEXT,
    "failureReason" TEXT,
    "expiresAt" DATETIME,
    "completedAt" DATETIME,
    "settledPaymentId" TEXT,
    "rawMeta" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "intentId" TEXT,
    "paymentId" TEXT,
    "raw" JSONB NOT NULL,
    "verificationNote" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PaymentProviderHealth" (
    "providerId" TEXT NOT NULL PRIMARY KEY,
    "healthy" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "organizationId" TEXT,
    "requesterUserId" TEXT,
    "requesterEmail" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "reviewerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "decisionReason" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "expiredAt" DATETIME,
    "executedAt" DATETIME,
    "failedAt" DATETIME,
    "expiresAt" DATETIME,
    "snapshot" JSONB NOT NULL,
    "executionError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FinancialApproval" ("actionType", "amountMinor", "approvedAt", "cancelledAt", "createdAt", "currency", "decisionReason", "executedAt", "executionError", "expiredAt", "expiresAt", "failedAt", "id", "organizationId", "reason", "rejectedAt", "requestedAt", "requesterEmail", "requesterUserId", "reviewerEmail", "reviewerUserId", "snapshot", "status", "targetId", "targetType", "updatedAt") SELECT "actionType", "amountMinor", "approvedAt", "cancelledAt", "createdAt", "currency", "decisionReason", "executedAt", "executionError", "expiredAt", "expiresAt", "failedAt", "id", "organizationId", "reason", "rejectedAt", "requestedAt", "requesterEmail", "requesterUserId", "reviewerEmail", "reviewerUserId", "snapshot", "status", "targetId", "targetType", "updatedAt" FROM "FinancialApproval";
DROP TABLE "FinancialApproval";
ALTER TABLE "new_FinancialApproval" RENAME TO "FinancialApproval";
CREATE INDEX "FinancialApproval_status_idx" ON "FinancialApproval"("status");
CREATE INDEX "FinancialApproval_actionType_idx" ON "FinancialApproval"("actionType");
CREATE INDEX "FinancialApproval_targetType_targetId_idx" ON "FinancialApproval"("targetType", "targetId");
CREATE INDEX "FinancialApproval_requesterEmail_idx" ON "FinancialApproval"("requesterEmail");
CREATE INDEX "FinancialApproval_organizationId_idx" ON "FinancialApproval"("organizationId");
CREATE INDEX "FinancialApproval_createdAt_idx" ON "FinancialApproval"("createdAt");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "gateway" TEXT NOT NULL DEFAULT 'manual',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "failureReason" TEXT,
    "providerRef" TEXT,
    "providerPaymentId" TEXT,
    "webhookEventId" TEXT,
    "paymentIntentId" TEXT,
    "method" TEXT,
    "methodMasked" TEXT,
    "feeMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "currency", "failureReason", "gateway", "id", "invoiceId", "organizationId", "status") SELECT "amount", "createdAt", "currency", "failureReason", "gateway", "id", "invoiceId", "organizationId", "status" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");
CREATE INDEX "Payment_webhookEventId_idx" ON "Payment"("webhookEventId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE TABLE "new_PlanChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'update',
    "requestedByEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "beforeSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "baseVersion" INTEGER NOT NULL,
    "reviewedByEmail" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "subscriptionId" TEXT,
    "organizationId" TEXT,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "billingCycle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanChangeRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanChangeRequest" ("action", "baseVersion", "beforeSnapshot", "billingCycle", "createdAt", "fromPlanId", "id", "organizationId", "planId", "proposedSnapshot", "reason", "rejectionReason", "requestedByEmail", "reviewedAt", "reviewedByEmail", "status", "subscriptionId", "toPlanId", "updatedAt") SELECT "action", "baseVersion", "beforeSnapshot", "billingCycle", "createdAt", "fromPlanId", "id", "organizationId", "planId", "proposedSnapshot", "reason", "rejectionReason", "requestedByEmail", "reviewedAt", "reviewedByEmail", "status", "subscriptionId", "toPlanId", "updatedAt" FROM "PlanChangeRequest";
DROP TABLE "PlanChangeRequest";
ALTER TABLE "new_PlanChangeRequest" RENAME TO "PlanChangeRequest";
CREATE INDEX "PlanChangeRequest_planId_status_idx" ON "PlanChangeRequest"("planId", "status");
CREATE INDEX "PlanChangeRequest_subscriptionId_status_idx" ON "PlanChangeRequest"("subscriptionId", "status");
CREATE INDEX "PlanChangeRequest_organizationId_status_idx" ON "PlanChangeRequest"("organizationId", "status");
CREATE INDEX "PlanChangeRequest_status_idx" ON "PlanChangeRequest"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerRef_key" ON "PaymentIntent"("providerRef");

-- CreateIndex
CREATE INDEX "PaymentIntent_organizationId_idx" ON "PaymentIntent"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentIntent_invoiceId_idx" ON "PaymentIntent"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_idx" ON "PaymentIntent"("provider");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_provider_status_idx" ON "PaymentWebhookLog"("provider", "status");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_createdAt_idx" ON "PaymentWebhookLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_eventId_key" ON "PaymentWebhookLog"("provider", "eventId");


