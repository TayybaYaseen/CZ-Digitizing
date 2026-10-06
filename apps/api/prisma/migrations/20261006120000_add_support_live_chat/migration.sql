-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('open', 'pending', 'resolved');

-- CreateEnum
CREATE TYPE "SupportContextType" AS ENUM ('general', 'order', 'custom_request', 'quote', 'file_format_request');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('customer', 'admin', 'system');

-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'support_chat';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'support_reply';
ALTER TYPE "NotificationType" ADD VALUE 'support_message';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "related_support_conversation_id" BIGINT;

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'open',
    "context_type" "SupportContextType" NOT NULL DEFAULT 'general',
    "order_id" BIGINT,
    "custom_request_id" BIGINT,
    "quote_id" BIGINT,
    "file_format_request_id" BIGINT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" TEXT,
    "last_message_sender_type" "SupportSenderType",
    "customer_last_read_message_id" BIGINT,
    "customer_last_read_at" TIMESTAMP(3),
    "admin_last_read_message_id" BIGINT,
    "admin_last_read_at" TIMESTAMP(3),
    "customer_unread_count" INTEGER NOT NULL DEFAULT 0,
    "admin_unread_count" INTEGER NOT NULL DEFAULT 0,
    "status_changed_at" TIMESTAMP(3),
    "status_changed_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "sender_type" "SupportSenderType" NOT NULL,
    "sender_user_id" BIGINT,
    "body" TEXT NOT NULL,
    "client_message_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_support_conversations_customer_activity" ON "support_conversations"("customer_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "idx_support_conversations_status_activity" ON "support_conversations"("status", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "idx_support_conversations_order" ON "support_conversations"("order_id");

-- CreateIndex
CREATE INDEX "idx_support_conversations_custom_request" ON "support_conversations"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_support_conversations_quote" ON "support_conversations"("quote_id");

-- CreateIndex
CREATE INDEX "idx_support_conversations_file_format_request" ON "support_conversations"("file_format_request_id");

-- CreateIndex
CREATE INDEX "idx_support_messages_conversation_id" ON "support_messages"("conversation_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_support_messages_conversation_client_id" ON "support_messages"("conversation_id", "client_message_id");

-- CreateIndex
CREATE INDEX "idx_notifications_related_support_conversation" ON "notifications"("related_support_conversation_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_support_conversation_id_fkey" FOREIGN KEY ("related_support_conversation_id") REFERENCES "support_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_file_format_request_id_fkey" FOREIGN KEY ("file_format_request_id") REFERENCES "file_format_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_status_changed_by_admin_id_fkey" FOREIGN KEY ("status_changed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Hand-written constraints Prisma can't express (docs/specs/2026-10-06-21-customer-admin-live-chat.md §9.6)
-- ---------------------------------------------------------------------------------------------

-- At most the one context FK that matches context_type may be set (it may later become NULL via
-- ON DELETE SET NULL, so "is set" is enforced by the service at creation, not here).
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversation_context_matches" CHECK (
  ("context_type" = 'general'             AND "order_id" IS NULL AND "custom_request_id" IS NULL AND "quote_id" IS NULL AND "file_format_request_id" IS NULL) OR
  ("context_type" = 'order'               AND "custom_request_id" IS NULL AND "quote_id" IS NULL AND "file_format_request_id" IS NULL) OR
  ("context_type" = 'custom_request'      AND "order_id" IS NULL AND "quote_id" IS NULL AND "file_format_request_id" IS NULL) OR
  ("context_type" = 'quote'               AND "order_id" IS NULL AND "custom_request_id" IS NULL AND "file_format_request_id" IS NULL) OR
  ("context_type" = 'file_format_request' AND "order_id" IS NULL AND "custom_request_id" IS NULL AND "quote_id" IS NULL)
);

-- One non-resolved conversation per customer per context target — makes "start a conversation"
-- idempotent and stops two concurrent starts creating twins (§13.3).
CREATE UNIQUE INDEX "uq_support_conversations_active_context" ON "support_conversations" (
  "customer_id", "context_type",
  COALESCE("order_id", 0), COALESCE("custom_request_id", 0), COALESCE("quote_id", 0), COALESCE("file_format_request_id", 0)
) WHERE "status" <> 'resolved';

-- Admin inbox "Unread only" filter.
CREATE INDEX "idx_support_conversations_admin_unread" ON "support_conversations" ("last_message_at" DESC) WHERE "admin_unread_count" > 0;

ALTER TABLE "support_conversations" ADD CONSTRAINT "support_unread_non_negative"
  CHECK ("customer_unread_count" >= 0 AND "admin_unread_count" >= 0);

ALTER TABLE "support_messages" ADD CONSTRAINT "support_message_body_length"
  CHECK (char_length("body") BETWEEN 1 AND 4000);
