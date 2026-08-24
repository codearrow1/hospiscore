-- Phase 7: persistent onboarding checklists (role portals). One row per
-- completed step; auto-derived steps never persist — only explicit marks.
CREATE TABLE "OnboardingProgress" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "subjectKind" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedBy" TEXT
);
CREATE UNIQUE INDEX "OnboardingProgress_subject_step_key" ON "OnboardingProgress"("subjectKind", "subjectId", "stepKey");
