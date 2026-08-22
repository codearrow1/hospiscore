-- Plan catalog structure: marketing catalog becomes the canonical commercial
-- definition of SaaS Plans. Folds the PlanLink identity into Plan itself, adds
-- the full commercial attribute set, per-country storefront pricing, and
-- structural approval actions.
ALTER TABLE "Plan" ADD COLUMN "marketingPlanId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "description" TEXT;
ALTER TABLE "Plan" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Plan" ADD COLUMN "descriptor" TEXT;
ALTER TABLE "Plan" ADD COLUMN "roomMin" INTEGER;
ALTER TABLE "Plan" ADD COLUMN "roomMax" INTEGER;
ALTER TABLE "Plan" ADD COLUMN "adminLimit" INTEGER;
ALTER TABLE "Plan" ADD COLUMN "staffLimit" INTEGER;
ALTER TABLE "Plan" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "isCustomPrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "archivedAt" DATETIME;

-- Fold the former PlanLink identity into Plan, then drop the join table.
UPDATE "Plan"
SET "marketingPlanId" = (
    SELECT l."marketingPlanId" FROM "PlanLink" l WHERE l."planId" = "Plan"."id"
)
WHERE EXISTS (
    SELECT 1 FROM "PlanLink" l2 WHERE l2."planId" = "Plan"."id"
);
DROP TABLE "PlanLink";
CREATE UNIQUE INDEX "Plan_marketingPlanId_key" ON "Plan"("marketingPlanId");

-- Localized storefront price points (same unit scale as the PricingDoc).
CREATE TABLE "PlanCountryPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "monthly" INTEGER NOT NULL,
    "annual" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanCountryPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanCountryPrice_planId_country_key" ON "PlanCountryPrice"("planId", "country");
CREATE INDEX "PlanCountryPrice_country_idx" ON "PlanCountryPrice"("country");

-- Structural approval actions + nullable planId (create requests have no plan
-- until approved). SQLite requires a table rebuild to relax NOT NULL.
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanChangeRequest"
    ("id", "planId", "action", "requestedByEmail", "status", "beforeSnapshot", "proposedSnapshot", "reason", "baseVersion", "reviewedByEmail", "reviewedAt", "rejectionReason", "createdAt", "updatedAt")
SELECT
    "id", "planId", 'update', "requestedByEmail", "status", "beforeSnapshot", "proposedSnapshot", "reason", "baseVersion", "reviewedByEmail", "reviewedAt", "rejectionReason", "createdAt", "updatedAt"
FROM "PlanChangeRequest";
DROP TABLE "PlanChangeRequest";
ALTER TABLE "new_PlanChangeRequest" RENAME TO "PlanChangeRequest";
PRAGMA foreign_keys=ON;
CREATE INDEX "PlanChangeRequest_planId_status_idx" ON "PlanChangeRequest"("planId", "status");
CREATE INDEX "PlanChangeRequest_status_idx" ON "PlanChangeRequest"("status");