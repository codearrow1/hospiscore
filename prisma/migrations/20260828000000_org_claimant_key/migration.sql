-- Phase G: scoped, DB-enforced dedup identity for self-serve claim-created
-- organizations. Nullable + unique so the constraint only applies to orgs
-- created through the canonical self-serve claim redemption path (claimantKey =
-- sha256(normalized claimant email)), not to admin-imported organizations.
-- Two concurrent redemptions by the same verified claimant collapse to ONE
-- organization (orphan-org race fix).
ALTER TABLE "Organization" ADD COLUMN "claimantKey" TEXT;
CREATE UNIQUE INDEX "Organization_claimantKey_key" ON "Organization"("claimantKey");
