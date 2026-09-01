-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('order_confirmed', 'payment_received', 'files_ready', 'quote_submitted', 'quote_response', 'custom_request_status_update', 'file_format_available', 'subscription_renewal', 'subscription_renewal_failed', 'credit_purchase', 'new_registration', 'new_device_login', 'taebo_waiting', 'taebo_answered', 'contact_message', 'receipt_uploaded', 'admin_alert', 'system_alert', 'order_status_change');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'whatsapp', 'in_app', 'push', 'sms');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_whatsapp_inbound_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "recipient_user_id" BIGINT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "related_order_id" BIGINT,
    "related_quote_id" BIGINT,
    "related_custom_request_id" BIGINT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("recipient_user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_expires_at" ON "notifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_preferences_user_type_channel" ON "notification_preferences"("user_id", "notification_type", "channel");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
