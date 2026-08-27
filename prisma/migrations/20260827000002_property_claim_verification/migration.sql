-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PropertyClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "propertyCity" TEXT,
    "propertyCountry" TEXT,
    "address" TEXT,
    "googlePhone" TEXT,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "acquisitionSource" TEXT,
    "acquisitionCampaign" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "propertyId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedBy" TEXT,
    CONSTRAINT "PropertyClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PropertyClaim" ("acquisitionCampaign", "acquisitionSource", "address", "createdAt", "createdById", "decidedAt", "decidedBy", "googlePhone", "id", "organizationId", "placeId", "propertyCity", "propertyCountry", "propertyId", "propertyName", "reason", "requesterEmail", "requesterName", "requesterPhone", "status") SELECT "acquisitionCampaign", "acquisitionSource", "address", "createdAt", "createdById", "decidedAt", "decidedBy", "googlePhone", "id", "organizationId", "placeId", "propertyCity", "propertyCountry", "propertyId", "propertyName", "reason", "requesterEmail", "requesterName", "requesterPhone", "status" FROM "PropertyClaim";
DROP TABLE "PropertyClaim";
ALTER TABLE "new_PropertyClaim" RENAME TO "PropertyClaim";
CREATE INDEX "PropertyClaim_organizationId_idx" ON "PropertyClaim"("organizationId");
CREATE INDEX "PropertyClaim_status_idx" ON "PropertyClaim"("status");
CREATE INDEX "PropertyClaim_placeId_idx" ON "PropertyClaim"("placeId");
CREATE UNIQUE INDEX "PropertyClaim_placeId_organizationId_key" ON "PropertyClaim"("placeId", "organizationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

