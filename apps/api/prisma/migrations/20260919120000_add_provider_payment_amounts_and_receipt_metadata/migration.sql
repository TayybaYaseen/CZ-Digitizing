-- A-013 (Orders & Payment Processing) critical fixes: lock the provider-charged amount/currency on
-- the order at creation time (webhook + server-side verification compare against these columns),
-- and record the detected content type / original filename of an uploaded bank-transfer receipt.
-- All columns are nullable: existing rows need no backfill, and the verification code fails closed
-- (refuses to confirm) for a provider order that has no locked amount.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "provider_amount_minor" INTEGER,
ADD COLUMN     "provider_charge_pkr" DECIMAL(10,2),
ADD COLUMN     "provider_currency" TEXT,
ADD COLUMN     "provider_rate_to_pkr" DECIMAL(14,6);

-- AlterTable
ALTER TABLE "payment_receipts" ADD COLUMN     "content_type" TEXT,
ADD COLUMN     "original_filename" TEXT;
