-- Subscriptions become market-aware: the country/currency the customer was
-- actually sold in, plus the recurring amount in that currency's units.
-- Legacy rows keep their defaults: US / USD / unitAmount NULL (the historical
-- USD-cents `mrr` snapshot stays authoritative for them).

ALTER TABLE "Subscription" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "Subscription" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Subscription" ADD COLUMN "unitAmount" INTEGER;

CREATE INDEX "Subscription_country_idx" ON "Subscription"("country");
