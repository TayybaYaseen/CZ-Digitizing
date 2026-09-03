-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('paypal', 'bank_transfer', 'credit_card');

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsapp_number" TEXT,
    "contact_email" TEXT,
    "domain" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "x_twitter_url" TEXT,
    "youtube_url" TEXT,
    "experience_start_year" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_admin_id" BIGINT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method_settings" (
    "id" BIGSERIAL NOT NULL,
    "method" "PaymentMethodType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_settings_method_key" ON "payment_method_settings"("method");

-- Backfill: seed the single settings row so the public site never renders with null contact
-- info (spec §4). Values per docs/specs/2026-08-28-03-admin-platform-settings.md §4.
INSERT INTO "platform_settings" ("id", "whatsapp_number", "contact_email", "domain", "experience_start_year", "updated_at")
VALUES (1, '+92 317 4604508', 'czdigitizing@gmail.com', 'czdigitizing.com', 2016, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
