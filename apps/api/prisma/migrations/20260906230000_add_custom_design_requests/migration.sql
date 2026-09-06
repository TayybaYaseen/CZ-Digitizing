-- CreateEnum
CREATE TYPE "CustomRequestType" AS ENUM ('embroidery_custom', 'vector_custom');

-- CreateEnum
CREATE TYPE "CustomRequestStatus" AS ENUM ('new', 'reviewing', 'quote_sent', 'approved', 'in_production', 'ready', 'delivered', 'completed', 'need_more_info', 'revision_required', 'cancelled');

-- CreateEnum
CREATE TYPE "CustomRequestPaymentStatus" AS ENUM ('pending', 'completed', 'refunded');

-- CreateEnum
CREATE TYPE "FileFormatRequestStatus" AS ENUM ('pending', 'fulfilled', 'rejected');

-- AlterTable: relax order_items' design-xor-bundle-xor-quote CHECK to also allow a
-- custom-request-sourced line (AC-4, docs/specs/2026-08-28-12-custom-design-requests.md)
ALTER TABLE "order_items" DROP CONSTRAINT "order_item_exactly_one_of_design_bundle_or_quote";
ALTER TABLE "order_items" ADD COLUMN     "custom_request_id" BIGINT;

-- CreateTable
CREATE TABLE "custom_requests" (
    "id" BIGSERIAL NOT NULL,
    "request_number" TEXT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "request_type" "CustomRequestType" NOT NULL,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'new',
    "image_url" TEXT,
    "size_value" TEXT,
    "machine_format" TEXT NOT NULL,
    "fabric_type" TEXT,
    "special_instructions" TEXT,
    "quoted_price_pkr" DECIMAL(10,2),
    "final_price_pkr" DECIMAL(10,2),
    "payment_status" "CustomRequestPaymentStatus" NOT NULL DEFAULT 'pending',
    "designer_id" BIGINT,
    "admin_notes" TEXT,
    "order_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "custom_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_references" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "image_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_messages" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "sender_user_id" BIGINT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_files" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "file_format" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "upload_hash" TEXT NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "first_download_at" TIMESTAMP(3),
    "last_download_at" TIMESTAMP(3),
    "max_download_attempts" INTEGER,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_format_requests" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "requested_format" TEXT NOT NULL,
    "notes" TEXT,
    "status" "FileFormatRequestStatus" NOT NULL DEFAULT 'pending',
    "fulfilled_file_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMP(3),

    CONSTRAINT "file_format_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_requests_request_number_key" ON "custom_requests"("request_number");

-- CreateIndex
CREATE UNIQUE INDEX "custom_requests_order_id_key" ON "custom_requests"("order_id");

-- CreateIndex
CREATE INDEX "idx_custom_requests_customer" ON "custom_requests"("customer_id");

-- CreateIndex
CREATE INDEX "idx_custom_requests_status" ON "custom_requests"("status");

-- CreateIndex
CREATE INDEX "idx_custom_requests_designer" ON "custom_requests"("designer_id");

-- CreateIndex
CREATE INDEX "idx_custom_request_references_request" ON "custom_request_references"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_custom_request_messages_request" ON "custom_request_messages"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_custom_request_files_request" ON "custom_request_files"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_file_format_requests_order" ON "file_format_requests"("order_id");

-- CreateIndex
CREATE INDEX "idx_file_format_requests_customer" ON "file_format_requests"("customer_id");

-- CreateIndex
CREATE INDEX "idx_notifications_related_custom_request" ON "notifications"("related_custom_request_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_custom_request_id_fkey" FOREIGN KEY ("related_custom_request_id") REFERENCES "custom_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_item_exactly_one_of_design_bundle_quote_or_custom_request" CHECK (
  (CASE WHEN "design_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "bundle_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "quote_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "custom_request_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- AddForeignKey
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_references" ADD CONSTRAINT "custom_request_references_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_messages" ADD CONSTRAINT "custom_request_messages_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_messages" ADD CONSTRAINT "custom_request_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_files" ADD CONSTRAINT "custom_request_files_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_format_requests" ADD CONSTRAINT "file_format_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_format_requests" ADD CONSTRAINT "file_format_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_format_requests" ADD CONSTRAINT "file_format_requests_fulfilled_file_id_fkey" FOREIGN KEY ("fulfilled_file_id") REFERENCES "design_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
