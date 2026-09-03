-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('paypal', 'stripe', 'bank_transfer');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('pending', 'completed', 'refunded', 'partially_refunded', 'failed');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('purchase', 'renewal');

-- CreateEnum
CREATE TYPE "ReceiptReviewStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "orders" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "payment_status" "OrderPaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_method" "PaymentMethod" NOT NULL,
    "transaction_type" "PaymentTransactionType" NOT NULL DEFAULT 'purchase',
    "total_pkr" DECIMAL(10,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'PKR',
    "bank_transfer_reference" TEXT,
    "paypal_order_id" TEXT,
    "paypal_capture_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "refunded_amount_pkr" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "design_id" BIGINT,
    "bundle_id" BIGINT,
    "size_id" BIGINT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_pkr" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_status" "ReceiptReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_admin_id" BIGINT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "currency_code" TEXT NOT NULL,
    "rate_to_pkr" DECIMAL(14,6) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("currency_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_bank_transfer_reference_key" ON "orders"("bank_transfer_reference");

-- CreateIndex
CREATE INDEX "idx_orders_customer" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "idx_payment_receipts_order" ON "payment_receipts"("order_id");

-- CreateIndex
CREATE INDEX "idx_notifications_related_order" ON "notifications"("related_order_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_authorized_files" ADD CONSTRAINT "customer_authorized_files_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "design_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "design_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK: an order_items row is a design line or a bundle line, never both/neither — same posture
-- as cart_items' cart_item_exactly_one_of_design_or_bundle (docs/specs/2026-08-28-08-orders-payment-processing.md,
-- aspect A-013). Prisma's schema DSL has no @@check clause in this Prisma version (5.x), so this is
-- hand-appended, matching every other DB-level invariant added this way in this repo.
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_exactly_one_of_design_or_bundle"
  CHECK ((design_id IS NOT NULL AND bundle_id IS NULL) OR (design_id IS NULL AND bundle_id IS NOT NULL));

