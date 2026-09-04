-- CreateEnum
CREATE TYPE "TestimonialSource" AS ENUM ('admin_curated', 'customer_submitted');

-- CreateEnum
CREATE TYPE "TestimonialModeration" AS ENUM ('approved', 'pending', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminModule" ADD VALUE 'tips';
ALTER TYPE "AdminModule" ADD VALUE 'about';

-- CreateTable
CREATE TABLE "faqs" (
    "id" BIGSERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "related_page" TEXT,
    "related_service" TEXT,
    "related_category" TEXT,
    "language_code" TEXT NOT NULL DEFAULT 'en',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "taebo_visible" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "helpful_yes_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_no_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embroiderer_tips" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language_code" TEXT NOT NULL DEFAULT 'en',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embroiderer_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_faq_links" (
    "tip_id" BIGINT NOT NULL,
    "faq_id" BIGINT NOT NULL,

    CONSTRAINT "tip_faq_links_pkey" PRIMARY KEY ("tip_id","faq_id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" BIGSERIAL NOT NULL,
    "customer_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "business" TEXT,
    "photo_url" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "service_used" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "source" "TestimonialSource" NOT NULL DEFAULT 'admin_curated',
    "moderation_status" "TestimonialModeration" NOT NULL DEFAULT 'approved',
    "customer_id" BIGINT,
    "order_id" BIGINT,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language_code" TEXT NOT NULL DEFAULT 'en',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_content" (
    "language_code" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "updated_by_admin_id" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_content_pkey" PRIMARY KEY ("language_code")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "media_urls" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_faqs_topic" ON "faqs"("topic");

-- CreateIndex
CREATE INDEX "idx_faqs_language" ON "faqs"("language_code");

-- CreateIndex
CREATE INDEX "idx_faqs_taebo_visible" ON "faqs"("taebo_visible");

-- CreateIndex
CREATE INDEX "idx_tips_category" ON "embroiderer_tips"("category");

-- CreateIndex
CREATE INDEX "idx_tips_language" ON "embroiderer_tips"("language_code");

-- CreateIndex
CREATE INDEX "idx_testimonials_visibility" ON "testimonials"("is_published", "moderation_status");

-- CreateIndex
CREATE INDEX "idx_testimonials_customer" ON "testimonials"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "idx_blog_posts_visibility" ON "blog_posts"("is_published", "language_code");

-- CreateIndex
CREATE INDEX "idx_blog_posts_category" ON "blog_posts"("category");

-- CreateIndex
CREATE INDEX "idx_portfolio_items_visibility" ON "portfolio_items"("is_published", "sort_order");

-- AddForeignKey
ALTER TABLE "tip_faq_links" ADD CONSTRAINT "tip_faq_links_tip_id_fkey" FOREIGN KEY ("tip_id") REFERENCES "embroiderer_tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_faq_links" ADD CONSTRAINT "tip_faq_links_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AC-4/AC-7: rating is a 1-5 star scale; hand-appended (Prisma 5.x schema DSL has no @@check
-- clause), same posture as order_items' exactly-one-of-design-or-bundle check.
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- spec §4 backfill requirement: seed one "en" row so the public About page never renders empty
-- before Admin fills it in.
INSERT INTO "about_content" ("language_code", "heading", "body", "image_urls", "updated_at")
VALUES ('en', 'About CZ Digitizing', 'Content coming soon — check back shortly.', '[]', CURRENT_TIMESTAMP);

