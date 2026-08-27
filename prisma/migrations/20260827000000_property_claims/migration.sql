-- AlterTable
ALTER TABLE "Property" ADD COLUMN "placeId" TEXT;

-- CreateTable
CREATE TABLE "PropertyClaim" (
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
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "propertyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedBy" TEXT,
    CONSTRAINT "PropertyClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PropertyClaim_organizationId_idx" ON "PropertyClaim"("organizationId");

-- CreateIndex
CREATE INDEX "PropertyClaim_status_idx" ON "PropertyClaim"("status");

-- CreateIndex
CREATE INDEX "PropertyClaim_placeId_idx" ON "PropertyClaim"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyClaim_placeId_organizationId_key" ON "PropertyClaim"("placeId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_placeId_key" ON "Property"("placeId");
