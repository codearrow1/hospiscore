-- Pricing sync + approval: Plan versioning, plan links, change requests, system settings
ALTER TABLE "Plan" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "PlanLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketingPlanId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanLink_marketingPlanId_key" ON "PlanLink"("marketingPlanId");
CREATE UNIQUE INDEX "PlanLink_planId_key" ON "PlanLink"("planId");

CREATE TABLE "PlanChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "beforeSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "baseVersion" INTEGER NOT NULL,
    "reviewedByEmail" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PlanChangeRequest_planId_status_idx" ON "PlanChangeRequest"("planId", "status");
CREATE INDEX "PlanChangeRequest_status_idx" ON "PlanChangeRequest"("status");

CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedByEmail" TEXT,
    "updatedAt" DATETIME NOT NULL
);
