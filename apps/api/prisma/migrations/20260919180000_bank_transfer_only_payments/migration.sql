-- A-013 business decision: BANK TRANSFER is the ONLY payment method. PayPal is removed and Stripe /
-- card payments are not used (docs/specs/2026-08-28-08-orders-payment-processing.md §11).
--
-- What this migration does, in order:
--   1. Refuses to run if any order was actually PAID (or refunded) through PayPal/Stripe — those
--      rows carry real provider transaction ids that must be reconciled by a person, not silently
--      rewritten. (No PayPal/Stripe credentials were ever configured in this repository, so on a
--      normal database this guard never trips.)
--   2. Copies every legacy provider reference into audit_logs, so nothing is lost when the columns go.
--   3. Turns still-open PayPal/Stripe orders into ordinary bank-transfer orders (same PKR total; a
--      bank-transfer reference is issued if something is still due) so those customers can pay by
--      bank transfer instead of being stranded.
--   4. Removes the provider columns (paypal_*, stripe_*, provider_* amount lock), the two
--      webhook-tracking tables and the paypal/stripe/credit_card enum values.
--   5. Lets an order line be a credit package or a subscription plan (bank-transfer purchases).
--
-- Reversible: NO for step 4 (columns/enum values are dropped; the audit_logs rows from step 2 keep
-- the provider references). Downtime: none beyond the brief ALTER locks. Backfill: none.

-- 1. Guard -------------------------------------------------------------------------------------
DO $$
DECLARE
  paid_provider_orders integer;
BEGIN
  SELECT count(*) INTO paid_provider_orders
  FROM "orders"
  WHERE "payment_method"::text IN ('paypal', 'stripe')
    AND "payment_status"::text IN ('completed', 'refunded', 'partially_refunded');

  IF paid_provider_orders > 0 THEN
    RAISE EXCEPTION 'Cannot remove PayPal/Stripe: % order(s) were paid or refunded through a provider. Reconcile them manually (their provider ids are in orders.paypal_*/stripe_payment_intent_id) before applying this migration.', paid_provider_orders;
  END IF;
END $$;

-- 2. Preserve the legacy provider references in the audit trail ---------------------------------
INSERT INTO "audit_logs" ("action_type", "resource_type", "resource_id", "changes")
SELECT
  'ORDER_PROVIDER_PAYMENT_METHOD_REMOVED',
  'order',
  "id"::text,
  jsonb_build_object(
    'previousPaymentMethod', "payment_method"::text,
    'newPaymentMethod', 'bank_transfer',
    'paypalOrderId', "paypal_order_id",
    'paypalCaptureId', "paypal_capture_id",
    'stripePaymentIntentId', "stripe_payment_intent_id",
    'providerCurrency', "provider_currency",
    'providerAmountMinor', "provider_amount_minor",
    'orderStatus', "status"::text,
    'paymentStatus', "payment_status"::text
  )
FROM "orders"
WHERE "payment_method"::text IN ('paypal', 'stripe');

-- 3. Still-open provider orders become bank-transfer orders ---------------------------------------
UPDATE "orders"
SET "bank_transfer_reference" =
  'CZD-' || upper(substr(md5(random()::text || "id"::text), 1, 4)) || '-' || upper(substr(md5(random()::text || "id"::text || 'ref'), 1, 4))
WHERE "payment_method"::text IN ('paypal', 'stripe')
  AND "bank_transfer_reference" IS NULL
  AND "status"::text IN ('pending', 'payment_pending')
  AND ("total_pkr" - "credits_used") > 0;

-- 4. Remove the provider columns, tables and enum values ------------------------------------------
ALTER TABLE "orders"
  DROP COLUMN "paypal_order_id",
  DROP COLUMN "paypal_capture_id",
  DROP COLUMN "stripe_payment_intent_id",
  DROP COLUMN "provider_currency",
  DROP COLUMN "provider_amount_minor",
  DROP COLUMN "provider_rate_to_pkr",
  DROP COLUMN "provider_charge_pkr";

DROP TABLE "pending_subscription_payments";
DROP TABLE "pending_credit_purchases";

-- PaymentMethod (orders.payment_method): only bank_transfer remains.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer');
ALTER TABLE "orders" ALTER COLUMN "payment_method" TYPE "PaymentMethod" USING ('bank_transfer'::"PaymentMethod");
DROP TYPE "PaymentMethod_old";

-- PaymentMethodType (payment_method_settings.method): drop the paypal / credit_card display rows.
DELETE FROM "payment_method_settings" WHERE "method"::text <> 'bank_transfer';
ALTER TYPE "PaymentMethodType" RENAME TO "PaymentMethodType_old";
CREATE TYPE "PaymentMethodType" AS ENUM ('bank_transfer');
ALTER TABLE "payment_method_settings" ALTER COLUMN "method" TYPE "PaymentMethodType" USING ("method"::text::"PaymentMethodType");
DROP TYPE "PaymentMethodType_old";

-- 4b. Customer-facing FAQ answers seeded by scripts/seed-content.ts still told customers PayPal was
-- accepted (Taebo, the chatbot, quotes the same rows). Only the exact seeded answers are rewritten, so
-- an answer an Admin edited by hand is left alone.
UPDATE "faqs"
SET "answer" = 'We accept Bank Transfer only. After checkout you transfer the exact amount in PKR to our bank account (shown on the payment page), then upload your payment receipt. We review it and confirm your payment before releasing your files — you will be notified either way.'
WHERE "question" = 'What payment methods do you accept?'
  AND "answer" = 'We currently accept PayPal and Bank Transfer. For bank transfer, you upload your payment receipt after checkout and we confirm it before releasing your files — you will be notified either way.';

UPDATE "faqs"
SET "answer" = 'Files are released for download once your payment is confirmed — that is, once our team verifies the bank-transfer receipt you uploaded. Every download is logged against your account.'
WHERE "question" = 'When can I download my purchased files?'
  AND "answer" = 'Files are released for download as soon as your payment is confirmed — instantly for PayPal, or once Admin verifies your uploaded bank-transfer receipt. Every download is logged against your account.';

-- 5. Credit-package / subscription-plan order lines ---------------------------------------------------
ALTER TABLE "order_items"
  ADD COLUMN "credit_package_id" BIGINT,
  ADD COLUMN "credits_granted" INTEGER,
  ADD COLUMN "subscription_plan_id" BIGINT;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_credit_package_id_fkey" FOREIGN KEY ("credit_package_id") REFERENCES "credit_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma's schema DSL has no CHECK clause, so this is hand-maintained (same as the constraints it replaces).
ALTER TABLE "order_items" DROP CONSTRAINT "order_item_exactly_one_of_design_bundle_quote_or_custom_request";
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_exactly_one_line_kind" CHECK (
  (CASE WHEN "design_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "bundle_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "quote_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "custom_request_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "credit_package_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "subscription_plan_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);
