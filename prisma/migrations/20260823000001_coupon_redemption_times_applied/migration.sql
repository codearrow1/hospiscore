-- Add timesApplied to CouponRedemption: exact tracking of how many invoices a repeating/forever coupon discount has applied to (SaaS M-07).
ALTER TABLE "CouponRedemption" ADD COLUMN "timesApplied" INTEGER NOT NULL DEFAULT 1;
