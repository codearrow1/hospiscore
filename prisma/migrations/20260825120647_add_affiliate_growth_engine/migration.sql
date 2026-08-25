-- AlterTable
ALTER TABLE "AffiliatePayout" ADD COLUMN "note" TEXT;
ALTER TABLE "AffiliatePayout" ADD COLUMN "period" TEXT;

-- CreateTable
CREATE TABLE "AffiliateCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "commissionModel" TEXT NOT NULL DEFAULT 'percent_mrr_12',
    "commissionValue" INTEGER NOT NULL DEFAULT 2000,
    "recurringDuration" INTEGER NOT NULL DEFAULT 12,
    "recurringLimit" INTEGER,
    "cookieDays" INTEGER NOT NULL DEFAULT 90,
    "attributionModel" TEXT NOT NULL DEFAULT 'first_touch',
    "holdingPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "maxCommission" INTEGER,
    "minPayout" INTEGER NOT NULL DEFAULT 5000,
    "planOverrides" JSONB,
    "countryOverrides" JSONB,
    "fraudRules" JSONB,
    "tier2OverrideRate" INTEGER NOT NULL DEFAULT 0,
    "tier3OverrideRate" INTEGER NOT NULL DEFAULT 0,
    "overrideFundingModel" TEXT NOT NULL DEFAULT 'company_funded',
    "maxTierDepth" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AffiliateCampaignMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "customRate" INTEGER,
    "expiresAt" DATETIME,
    CONSTRAINT "AffiliateCampaignMember_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedByEmail" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AffiliateApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "website" TEXT,
    "audience" TEXT,
    "socialProfiles" JSONB,
    "promotionMethod" TEXT,
    "geography" TEXT,
    "niche" TEXT,
    "expectedTraffic" TEXT,
    "planDescription" TEXT,
    "reviewNote" TEXT,
    "reviewedByEmail" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateApplication_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateFraudCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolutionNote" TEXT,
    "resolvedByEmail" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateFraudCase_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "campaignId" TEXT,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "AffiliateAgreement_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAgreement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliatePerformanceTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "minCustomers" INTEGER,
    "minMrr" INTEGER,
    "minRevenue" INTEGER,
    "commissionValue" INTEGER,
    "commissionModel" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliatePerformanceTier_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "campaignId" TEXT,
    "subscriptionId" TEXT,
    "touchpoint" TEXT NOT NULL,
    "clickId" TEXT,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateAttribution_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateNotification_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "campaignId" TEXT,
    "affiliateId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAsset_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateRecruitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentAffiliateId" TEXT NOT NULL,
    "childAffiliateId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateRecruitment_parentAffiliateId_fkey" FOREIGN KEY ("parentAffiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateRecruitment_childAffiliateId_fkey" FOREIGN KEY ("childAffiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "website" TEXT,
    "audience" TEXT,
    "promotionMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "referralCode" TEXT NOT NULL,
    "couponCode" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'standard',
    "commissionModel" TEXT NOT NULL DEFAULT 'percent_mrr_12',
    "commissionValue" INTEGER NOT NULL DEFAULT 2000,
    "taxDetails" TEXT,
    "payoutMethod" TEXT,
    "payoutDetails" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "campaignId" TEXT,
    "parentId" TEXT,
    "recruitedById" TEXT,
    "agreedTermsAt" DATETIME,
    "applicationData" JSONB,
    "riskScore" INTEGER,
    "riskReasons" JSONB,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "customCommissionModel" TEXT,
    "customCommissionValue" INTEGER,
    "customRecurringDuration" INTEGER,
    "customCookieDays" INTEGER,
    "customHoldingPeriodDays" INTEGER,
    "customMaxCommission" INTEGER,
    "customMinPayout" INTEGER,
    CONSTRAINT "Affiliate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Affiliate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Affiliate_recruitedById_fkey" FOREIGN KEY ("recruitedById") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Affiliate" ("audience", "businessName", "commissionModel", "commissionValue", "country", "couponCode", "createdAt", "email", "id", "name", "payoutDetails", "payoutMethod", "phone", "promotionMethod", "referralCode", "status", "taxDetails", "tier", "updatedAt", "userId", "website") SELECT "audience", "businessName", "commissionModel", "commissionValue", "country", "couponCode", "createdAt", "email", "id", "name", "payoutDetails", "payoutMethod", "phone", "promotionMethod", "referralCode", "status", "taxDetails", "tier", "updatedAt", "userId", "website" FROM "Affiliate";
DROP TABLE "Affiliate";
ALTER TABLE "new_Affiliate" RENAME TO "Affiliate";
CREATE UNIQUE INDEX "Affiliate_email_key" ON "Affiliate"("email");
CREATE UNIQUE INDEX "Affiliate_referralCode_key" ON "Affiliate"("referralCode");
CREATE UNIQUE INDEX "Affiliate_couponCode_key" ON "Affiliate"("couponCode");
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");
CREATE INDEX "Affiliate_referralCode_idx" ON "Affiliate"("referralCode");
CREATE INDEX "Affiliate_campaignId_idx" ON "Affiliate"("campaignId");
CREATE INDEX "Affiliate_parentId_idx" ON "Affiliate"("parentId");
CREATE INDEX "Affiliate_recruitedById_idx" ON "Affiliate"("recruitedById");
CREATE TABLE "new_AffiliateClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "campaignId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT,
    "sessionId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateClick" ("affiliateId", "createdAt", "id", "ip", "referrer", "userAgent", "utmCampaign", "utmMedium", "utmSource") SELECT "affiliateId", "createdAt", "id", "ip", "referrer", "userAgent", "utmCampaign", "utmMedium", "utmSource" FROM "AffiliateClick";
DROP TABLE "AffiliateClick";
ALTER TABLE "new_AffiliateClick" RENAME TO "AffiliateClick";
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");
CREATE INDEX "AffiliateClick_campaignId_idx" ON "AffiliateClick"("campaignId");
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");
CREATE INDEX "AffiliateClick_sessionId_idx" ON "AffiliateClick"("sessionId");
CREATE TABLE "new_AffiliateCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT,
    "partnerId" TEXT,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "leadId" TEXT,
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
    CONSTRAINT "AffiliateCommission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_parentCommissionId_fkey" FOREIGN KEY ("parentCommissionId") REFERENCES "AffiliateCommission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateCommission" ("affiliateId", "amount", "createdAt", "currency", "id", "leadId", "model", "organizationId", "paidAmount", "partnerId", "status", "subscriptionId", "updatedAt") SELECT "affiliateId", "amount", "createdAt", "currency", "id", "leadId", "model", "organizationId", "paidAmount", "partnerId", "status", "subscriptionId", "updatedAt" FROM "AffiliateCommission";
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

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCampaign_slug_key" ON "AffiliateCampaign"("slug");

-- CreateIndex
CREATE INDEX "AffiliateCampaign_status_idx" ON "AffiliateCampaign"("status");

-- CreateIndex
CREATE INDEX "AffiliateCampaign_slug_idx" ON "AffiliateCampaign"("slug");

-- CreateIndex
CREATE INDEX "AffiliateCampaignMember_campaignId_idx" ON "AffiliateCampaignMember"("campaignId");

-- CreateIndex
CREATE INDEX "AffiliateCampaignMember_affiliateId_idx" ON "AffiliateCampaignMember"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCampaignMember_affiliateId_campaignId_key" ON "AffiliateCampaignMember"("affiliateId", "campaignId");

-- CreateIndex
CREATE INDEX "AffiliateApplication_affiliateId_idx" ON "AffiliateApplication"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateApplication_status_idx" ON "AffiliateApplication"("status");

-- CreateIndex
CREATE INDEX "AffiliateApplication_createdAt_idx" ON "AffiliateApplication"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateFraudCase_affiliateId_idx" ON "AffiliateFraudCase"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateFraudCase_status_idx" ON "AffiliateFraudCase"("status");

-- CreateIndex
CREATE INDEX "AffiliateFraudCase_createdAt_idx" ON "AffiliateFraudCase"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateAgreement_affiliateId_idx" ON "AffiliateAgreement"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateAgreement_campaignId_idx" ON "AffiliateAgreement"("campaignId");

-- CreateIndex
CREATE INDEX "AffiliateAgreement_version_idx" ON "AffiliateAgreement"("version");

-- CreateIndex
CREATE INDEX "AffiliatePerformanceTier_campaignId_idx" ON "AffiliatePerformanceTier"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePerformanceTier_campaignId_tierName_key" ON "AffiliatePerformanceTier"("campaignId", "tierName");

-- CreateIndex
CREATE INDEX "AffiliateAttribution_affiliateId_idx" ON "AffiliateAttribution"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateAttribution_campaignId_idx" ON "AffiliateAttribution"("campaignId");

-- CreateIndex
CREATE INDEX "AffiliateAttribution_subscriptionId_idx" ON "AffiliateAttribution"("subscriptionId");

-- CreateIndex
CREATE INDEX "AffiliateAttribution_clickId_idx" ON "AffiliateAttribution"("clickId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAttribution_organizationId_key" ON "AffiliateAttribution"("organizationId");

-- CreateIndex
CREATE INDEX "AffiliateNotification_affiliateId_readAt_idx" ON "AffiliateNotification"("affiliateId", "readAt");

-- CreateIndex
CREATE INDEX "AffiliateNotification_createdAt_idx" ON "AffiliateNotification"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateAsset_campaignId_idx" ON "AffiliateAsset"("campaignId");

-- CreateIndex
CREATE INDEX "AffiliateAsset_affiliateId_idx" ON "AffiliateAsset"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateAsset_type_idx" ON "AffiliateAsset"("type");

-- CreateIndex
CREATE INDEX "AffiliateRecruitment_parentAffiliateId_idx" ON "AffiliateRecruitment"("parentAffiliateId");

-- CreateIndex
CREATE INDEX "AffiliateRecruitment_childAffiliateId_idx" ON "AffiliateRecruitment"("childAffiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateRecruitment_parentAffiliateId_childAffiliateId_key" ON "AffiliateRecruitment"("parentAffiliateId", "childAffiliateId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_period_idx" ON "AffiliatePayout"("period");

-- Seed: default affiliate campaign (backward-compatible with existing affiliates)
INSERT INTO "AffiliateCampaign" ("id", "name", "slug", "description", "status", "commissionModel", "commissionValue", "recurringDuration", "recurringLimit", "cookieDays", "attributionModel", "holdingPeriodDays", "maxCommission", "minPayout", "tier2OverrideRate", "tier3OverrideRate", "overrideFundingModel", "maxTierDepth", "createdAt", "updatedAt")
VALUES ('cm_default_000000000001', 'Default Affiliate Program', 'default', 'Backward-compatible default campaign for all existing affiliates', 'active', 'percent_mrr_12', 2000, 12, NULL, 90, 'first_touch', 30, NULL, 5000, 0, 0, 'company_funded', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed: performance tiers for default campaign
INSERT INTO "AffiliatePerformanceTier" ("id", "campaignId", "tierName", "minCustomers", "minMrr", "minRevenue", "commissionValue", "commissionModel", "displayOrder", "createdAt", "updatedAt")
VALUES
  ('tier_default_bronze',   'cm_default_000000000001', 'bronze',   0,   0,     0,      2000, 'percent_mrr_12', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tier_default_silver',   'cm_default_000000000001', 'silver',   5,   50000, 100000, 2500, 'percent_mrr_12', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tier_default_gold',     'cm_default_000000000001', 'gold',     15,  200000, 500000, 3000, 'percent_mrr_12', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tier_default_platinum', 'cm_default_000000000001', 'platinum', 50,  1000000, 2000000, 3500, 'percent_mrr_12', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed: global affiliate settings
INSERT INTO "AffiliateSetting" ("key", "value", "updatedAt")
VALUES
  ('program_name', '"HospiOS Affiliate Program"', CURRENT_TIMESTAMP),
  ('default_commission_model', '"percent_mrr_12"', CURRENT_TIMESTAMP),
  ('default_commission_value', '2000', CURRENT_TIMESTAMP),
  ('default_recurring_duration', '12', CURRENT_TIMESTAMP),
  ('default_holding_period_days', '30', CURRENT_TIMESTAMP),
  ('default_cookie_days', '90', CURRENT_TIMESTAMP),
  ('default_attribution_model', '"first_touch"', CURRENT_TIMESTAMP),
  ('default_max_tier_depth', '3', CURRENT_TIMESTAMP),
  ('default_min_payout', '5000', CURRENT_TIMESTAMP),
  ('self_referral_block', 'true', CURRENT_TIMESTAMP),
  ('fraud_enabled', 'false', CURRENT_TIMESTAMP);
