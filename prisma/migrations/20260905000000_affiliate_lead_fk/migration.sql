-- Checkpoint 3: AffiliateCommission.leadId becomes a real FK to MarketingLead
-- (ADR-0002). Adds legacyLeadId to preserve the original DataFile uuid, remaps
-- existing leadId (legacy uuid) -> MarketingLead.id where a mirror row exists,
-- and enables the growth.persist.prisma plane automatically (global flag).
--
-- SQLite has no ALTER TABLE ... ADD CONSTRAINT, so Prisma rebuilds the table.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AffiliateCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT,
    "partnerId" TEXT,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "leadId" TEXT,
    "legacyLeadId" TEXT,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "campaignId" TEXT,
    "parentCommissionId" TEXT,
    "overrideType" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "ruleSnapshot" JSONB,
    "commissionType" TEXT,
    "rate" INTEGER,
    "fixedAmount" INTEGER,
    "base" INTEGER,
    "eligibleAt" DATETIME,
    "holdUntil" DATETIME,
    "approvedAt" DATETIME,
    "payableAt" DATETIME,
    "paidAt" DATETIME,
    "reversedAt" DATETIME,
    "reversalAmount" INTEGER,
    "reversalReason" TEXT,
    "adjustedBy" TEXT,
    "performanceTier" TEXT,
    CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_parentCommissionId_fkey" FOREIGN KEY ("parentCommissionId") REFERENCES "AffiliateCommission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateCommission" ("adjustedBy", "affiliateId", "amount", "approvedAt", "base", "campaignId", "commissionType", "createdAt", "currency", "depth", "eligibleAt", "fixedAmount", "holdUntil", "id", "leadId", "model", "organizationId", "overrideType", "paidAmount", "paidAt", "parentCommissionId", "partnerId", "payableAt", "performanceTier", "rate", "reversalAmount", "reversalReason", "reversedAt", "ruleSnapshot", "status", "subscriptionId", "updatedAt") SELECT "adjustedBy", "affiliateId", "amount", "approvedAt", "base", "campaignId", "commissionType", "createdAt", "currency", "depth", "eligibleAt", "fixedAmount", "holdUntil", "id", "leadId", "model", "organizationId", "overrideType", "paidAmount", "paidAt", "parentCommissionId", "partnerId", "payableAt", "performanceTier", "rate", "reversalAmount", "reversalReason", "reversedAt", "ruleSnapshot", "status", "subscriptionId", "updatedAt" FROM "AffiliateCommission";
DROP TABLE "AffiliateCommission";
ALTER TABLE "new_AffiliateCommission" RENAME TO "AffiliateCommission";
CREATE INDEX "AffiliateCommission_affiliateId_idx" ON "AffiliateCommission"("affiliateId");
CREATE INDEX "AffiliateCommission_partnerId_idx" ON "AffiliateCommission"("partnerId");
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");
CREATE INDEX "AffiliateCommission_organizationId_idx" ON "AffiliateCommission"("organizationId");
CREATE INDEX "AffiliateCommission_campaignId_idx" ON "AffiliateCommission"("campaignId");
CREATE INDEX "AffiliateCommission_parentCommissionId_idx" ON "AffiliateCommission"("parentCommissionId");
CREATE INDEX "AffiliateCommission_holdUntil_idx" ON "AffiliateCommission"("holdUntil");
CREATE INDEX "AffiliateCommission_subscriptionId_idx" ON "AffiliateCommission"("subscriptionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Back up the original DataFile uuid, then resolve leadId to the Prisma
-- MarketingLead.id via legacyLeadId. Unmatched commissions keep a NULL leadId
-- (their uuid is preserved in legacyLeadId) so boot never fails.
UPDATE "AffiliateCommission" SET "legacyLeadId" = "leadId";
UPDATE "AffiliateCommission" SET "leadId" = (
  SELECT "id" FROM "MarketingLead" m WHERE m."legacyLeadId" = "AffiliateCommission"."legacyLeadId"
);

-- Enable the growth.persist.prisma plane automatically: a single global
-- (unscoped) flag row, matching the reader in lib/growth/flag.ts.
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "planId", "organizationId", "propertyId", "country", "percentage", "isBeta", "createdAt", "updatedAt")
SELECT 'growth_persist_prisma', 'growth.persist.prisma', 1, NULL, NULL, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "FeatureFlag"
  WHERE "key" = 'growth.persist.prisma'
    AND "organizationId" IS NULL
    AND "planId" IS NULL
    AND "propertyId" IS NULL
    AND "country" IS NULL
);
