-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyLeadId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "propertyName" TEXT,
    "propertyType" TEXT,
    "city" TEXT,
    "country" TEXT,
    "rooms" INTEGER,
    "currentPms" TEXT,
    "requiredModules" JSONB,
    "planInterest" TEXT,
    "billingCycle" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL,
    "attribution" JSONB,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "band" TEXT NOT NULL DEFAULT 'cold',
    "ownerEmail" TEXT,
    "notes" JSONB,
    "nextFollowUpAt" DATETIME,
    "lastContactAt" DATETIME,
    "estimatedValue" INTEGER NOT NULL DEFAULT 0,
    "estimatedValueCurrency" TEXT,
    "priority" TEXT,
    "trialStartedAt" DATETIME,
    "lostReason" TEXT,
    "convertedCustomerId" TEXT,
    "convertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketingLeadEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byEmail" TEXT,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    CONSTRAINT "MarketingLeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingDemoBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "sourceId" TEXT,
    "startAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'new',
    "demoType" TEXT,
    "assignedTo" TEXT,
    "meetingUrl" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingDemoBooking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingReportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "propertySlug" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingReportRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingConvertedCustomer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "convertedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byEmail" TEXT,
    "plan" TEXT,
    "billingCycle" TEXT,
    "country" TEXT,
    "estimatedValue" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "adminUserId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingConvertedCustomer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLead_legacyLeadId_key" ON "MarketingLead"("legacyLeadId");

-- CreateIndex
CREATE INDEX "MarketingLead_email_idx" ON "MarketingLead"("email");

-- CreateIndex
CREATE INDEX "MarketingLead_stage_idx" ON "MarketingLead"("stage");

-- CreateIndex
CREATE INDEX "MarketingLead_source_idx" ON "MarketingLead"("source");

-- CreateIndex
CREATE INDEX "MarketingLead_country_idx" ON "MarketingLead"("country");

-- CreateIndex
CREATE INDEX "MarketingLead_ownerEmail_idx" ON "MarketingLead"("ownerEmail");

-- CreateIndex
CREATE INDEX "MarketingLead_band_idx" ON "MarketingLead"("band");

-- CreateIndex
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLeadEvent_leadId_idx" ON "MarketingLeadEvent"("leadId");

-- CreateIndex
CREATE INDEX "MarketingLeadEvent_at_idx" ON "MarketingLeadEvent"("at");

-- CreateIndex
CREATE INDEX "MarketingDemoBooking_leadId_idx" ON "MarketingDemoBooking"("leadId");

-- CreateIndex
CREATE INDEX "MarketingDemoBooking_status_idx" ON "MarketingDemoBooking"("status");

-- CreateIndex
CREATE INDEX "MarketingDemoBooking_startAt_idx" ON "MarketingDemoBooking"("startAt");

-- CreateIndex
CREATE INDEX "MarketingReportRequest_email_idx" ON "MarketingReportRequest"("email");

-- CreateIndex
CREATE INDEX "MarketingReportRequest_propertySlug_idx" ON "MarketingReportRequest"("propertySlug");

-- CreateIndex
CREATE INDEX "MarketingReportRequest_createdAt_idx" ON "MarketingReportRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingConvertedCustomer_leadId_key" ON "MarketingConvertedCustomer"("leadId");

-- CreateIndex
CREATE INDEX "MarketingConvertedCustomer_leadId_idx" ON "MarketingConvertedCustomer"("leadId");

-- CreateIndex
CREATE INDEX "MarketingConvertedCustomer_convertedAt_idx" ON "MarketingConvertedCustomer"("convertedAt");
