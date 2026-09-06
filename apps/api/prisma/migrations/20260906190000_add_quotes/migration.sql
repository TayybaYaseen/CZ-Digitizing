-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'new', 'responded', 'converted_to_order');

-- CreateEnum
CREATE TYPE "QuoteMessageSender" AS ENUM ('customer', 'admin');

-- CreateTable
CREATE TABLE "quote_questions" (
    "id" BIGSERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "service_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT,
    "country" TEXT,
    "service_id" BIGINT NOT NULL,
    "design_upload_path" TEXT,
    "size" TEXT,
    "quantity" INTEGER,
    "fabric" TEXT,
    "thread_colors" TEXT,
    "format_preference" TEXT,
    "deadline" TIMESTAMP(3),
    "instructions" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "access_token" TEXT NOT NULL,
    "suggested_price_pkr" DECIMAL(10,2),
    "quoted_price_pkr" DECIMAL(10,2),
    "admin_notes" TEXT,
    "responded_by_admin_id" BIGINT,
    "responded_at" TIMESTAMP(3),
    "order_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_messages" (
    "id" BIGSERIAL NOT NULL,
    "quote_id" BIGINT NOT NULL,
    "sender_role" "QuoteMessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_messages_pkey" PRIMARY KEY ("id")
);

-- AlterTable: relax order_items' design-xor-bundle CHECK to design-xor-bundle-xor-quote (AC-7)
ALTER TABLE "order_items" DROP CONSTRAINT "order_item_exactly_one_of_design_or_bundle";
ALTER TABLE "order_items" ADD COLUMN "quote_id" BIGINT;
ALTER TABLE "order_items" ADD COLUMN "custom_description" TEXT;
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_exactly_one_of_design_bundle_or_quote" CHECK (
  (CASE WHEN "design_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "bundle_id" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "quote_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- AlterTable: real FK for notifications.related_quote_id (was a plain BigInt with no @relation,
-- per that column's own former TODO(A-016) comment)
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_quote_id_fkey" FOREIGN KEY ("related_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "quotes_access_token_key" ON "quotes"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_order_id_key" ON "quotes"("order_id");

-- CreateIndex
CREATE INDEX "idx_quote_questions_service" ON "quote_questions"("service_id");

-- CreateIndex
CREATE INDEX "idx_quotes_customer" ON "quotes"("customer_id");

-- CreateIndex
CREATE INDEX "idx_quotes_service" ON "quotes"("service_id");

-- CreateIndex
CREATE INDEX "idx_quotes_status" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "idx_quote_messages_quote" ON "quote_messages"("quote_id");

-- CreateIndex
CREATE INDEX "idx_notifications_related_quote" ON "notifications"("related_quote_id");

-- AddForeignKey
ALTER TABLE "quote_questions" ADD CONSTRAINT "quote_questions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_messages" ADD CONSTRAINT "quote_messages_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
