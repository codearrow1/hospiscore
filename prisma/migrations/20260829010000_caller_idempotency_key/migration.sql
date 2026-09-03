-- Final pre-launch closure, Phase 4 (B-3): durable caller idempotency keys.
--
-- Adds a nullable, UNIQUE idempotencyKey to Invoice and Payment so that a
-- caller can safely retry creation/recording after a timeout and be guaranteed
-- the SAME logical operation is NOT duplicated:
--   - same key  -> same logical result (no second invoice/payment row)
--   - different key -> new operation
--   - provider idempotency (PaymentIntent.idempotencyKey / providerRef),
--     webhook dedup (PaymentWebhookLog provider+eventId), and the providerRef /
--     providerPaymentId uniqueness on Payment are all untouched.
--
-- The column is NULLABLE so legacy rows and callers that choose not to supply a
-- key are completely unaffected. SQLite treats NULLs as distinct in a UNIQUE
-- index, so existing/external rows never collide. Move is purely additive —
-- no table recreation, no data backfill, no data loss.
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
