-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "requesterEmail" TEXT,
    "assigneeEmail" TEXT,
    "slaDueAt" DATETIME,
    "firstResponseAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "website" TEXT,
    "type" TEXT NOT NULL DEFAULT 'reseller',
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "status" TEXT NOT NULL DEFAULT 'applied',
    "commissionModel" TEXT NOT NULL DEFAULT 'percent_first',
    "commissionValue" INTEGER NOT NULL DEFAULT 1500,
    "referralCode" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Franchisee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "revenueShareBps" INTEGER NOT NULL DEFAULT 1500,
    "agreementStartAt" DATETIME,
    "agreementEndAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FranchiseTerritory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentTerritoryId" TEXT,
    "franchiseeId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "type" TEXT NOT NULL DEFAULT 'region',
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FranchiseTerritory_parentTerritoryId_fkey" FOREIGN KEY ("parentTerritoryId") REFERENCES "FranchiseTerritory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FranchiseTerritory_franchiseeId_fkey" FOREIGN KEY ("franchiseeId") REFERENCES "Franchisee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AffiliateCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT,
    "partnerId" TEXT,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "leadId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateCommission" ("affiliateId", "amount", "createdAt", "currency", "id", "leadId", "model", "organizationId", "status", "subscriptionId", "updatedAt") SELECT "affiliateId", "amount", "createdAt", "currency", "id", "leadId", "model", "organizationId", "status", "subscriptionId", "updatedAt" FROM "AffiliateCommission";
DROP TABLE "AffiliateCommission";
ALTER TABLE "new_AffiliateCommission" RENAME TO "AffiliateCommission";
CREATE INDEX "AffiliateCommission_affiliateId_idx" ON "AffiliateCommission"("affiliateId");
CREATE INDEX "AffiliateCommission_partnerId_idx" ON "AffiliateCommission"("partnerId");
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");
CREATE INDEX "AffiliateCommission_organizationId_idx" ON "AffiliateCommission"("organizationId");
CREATE TABLE "new_AffiliatePayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT,
    "partnerId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL DEFAULT 'bank',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliatePayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliatePayout" ("affiliateId", "amount", "createdAt", "currency", "id", "method", "status", "updatedAt") SELECT "affiliateId", "amount", "createdAt", "currency", "id", "method", "status", "updatedAt" FROM "AffiliatePayout";
DROP TABLE "AffiliatePayout";
ALTER TABLE "new_AffiliatePayout" RENAME TO "AffiliatePayout";
CREATE INDEX "AffiliatePayout_affiliateId_idx" ON "AffiliatePayout"("affiliateId");
CREATE INDEX "AffiliatePayout_partnerId_idx" ON "AffiliatePayout"("partnerId");
CREATE INDEX "AffiliatePayout_status_idx" ON "AffiliatePayout"("status");
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "businessName" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "primaryContactId" TEXT,
    "affiliateId" TEXT,
    "partnerId" TEXT,
    "franchiseTerritoryId" TEXT,
    "acquisitionSource" TEXT,
    "acquisitionCampaign" TEXT,
    "healthScore" INTEGER,
    "healthStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mrr" INTEGER NOT NULL DEFAULT 0,
    "arr" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_franchiseTerritoryId_fkey" FOREIGN KEY ("franchiseTerritoryId") REFERENCES "FranchiseTerritory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Organization" ("acquisitionCampaign", "acquisitionSource", "affiliateId", "arr", "businessName", "country", "createdAt", "healthScore", "healthStatus", "id", "industry", "legalName", "mrr", "partnerId", "primaryContactId", "status", "updatedAt", "website") SELECT "acquisitionCampaign", "acquisitionSource", "affiliateId", "arr", "businessName", "country", "createdAt", "healthScore", "healthStatus", "id", "industry", "legalName", "mrr", "partnerId", "primaryContactId", "status", "updatedAt", "website" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE INDEX "Organization_country_idx" ON "Organization"("country");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_idx" ON "SupportTicket"("organizationId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_slaDueAt_idx" ON "SupportTicket"("slaDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_referralCode_key" ON "Partner"("referralCode");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Franchisee_email_key" ON "Franchisee"("email");

-- CreateIndex
CREATE INDEX "Franchisee_status_idx" ON "Franchisee"("status");

-- CreateIndex
CREATE INDEX "FranchiseTerritory_franchiseeId_idx" ON "FranchiseTerritory"("franchiseeId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseTerritory_country_region_city_type_status_key" ON "FranchiseTerritory"("country", "region", "city", "type", "status");
