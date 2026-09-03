-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FranchisePayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "franchiseeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FranchisePayout_franchiseeId_fkey" FOREIGN KEY ("franchiseeId") REFERENCES "Franchisee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_createdAt_idx" ON "TicketComment"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "FranchisePayout_status_idx" ON "FranchisePayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FranchisePayout_franchiseeId_period_key" ON "FranchisePayout"("franchiseeId", "period");

-- CreateIndex
CREATE INDEX "OnboardingProgress_subjectKind_subjectId_idx" ON "OnboardingProgress"("subjectKind", "subjectId");

-- RedefineIndex
DROP INDEX "OnboardingProgress_subject_step_key";
CREATE UNIQUE INDEX "OnboardingProgress_subjectKind_subjectId_stepKey_key" ON "OnboardingProgress"("subjectKind", "subjectId", "stepKey");
