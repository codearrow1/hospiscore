-- Payout FIFO consumption: track partially consumed commissions so a payout
-- never over-consumes (or under-consumes) whole commission rows.
ALTER TABLE "AffiliateCommission" ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0;
