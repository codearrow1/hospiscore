-- Phase I: Four-eyes / dual-approval financial control system.
-- Adds the FinancialApproval record for high-risk financial actions
-- (invoice void, payment refund, payout release). Requester and approver
-- are enforced as different users by the framework. `snapshot` stores the
-- immutable intended action + target state at request time.
CREATE TABLE "FinancialApproval" (
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
    "snapshot" TEXT NOT NULL,
    "executionError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "FinancialApproval_status_idx" ON "FinancialApproval"("status");
CREATE INDEX "FinancialApproval_actionType_idx" ON "FinancialApproval"("actionType");
CREATE INDEX "FinancialApproval_targetType_targetId_idx" ON "FinancialApproval"("targetType", "targetId");
CREATE INDEX "FinancialApproval_requesterEmail_idx" ON "FinancialApproval"("requesterEmail");
CREATE INDEX "FinancialApproval_organizationId_idx" ON "FinancialApproval"("organizationId");
CREATE INDEX "FinancialApproval_createdAt_idx" ON "FinancialApproval"("createdAt");
