-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminModule" ADD VALUE 'home_sections';
ALTER TYPE "AdminModule" ADD VALUE 'advertisements';
ALTER TYPE "AdminModule" ADD VALUE 'header_media';

-- CreateTable
CREATE TABLE "home_sections" (
    "id" BIGSERIAL NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_section_designs" (
    "id" BIGSERIAL NOT NULL,
    "home_section_id" BIGINT NOT NULL,
    "design_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "home_section_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" BIGSERIAL NOT NULL,
    "heading" TEXT NOT NULL,
    "subheading" TEXT,
    "offer_text" TEXT,
    "banner_image_url" TEXT,
    "banner_video_url" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "target_category_id" BIGINT,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisement_target_designs" (
    "advertisement_id" BIGINT NOT NULL,
    "design_id" BIGINT NOT NULL,

    CONSTRAINT "advertisement_target_designs_pkey" PRIMARY KEY ("advertisement_id","design_id")
);

-- CreateTable
CREATE TABLE "header_media" (
    "id" BIGSERIAL NOT NULL,
    "image_url" TEXT,
    "video_url" TEXT,
    "heading" TEXT,
    "subheading" TEXT,
    "cta_link" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_carousel_item" BOOLEAN NOT NULL DEFAULT true,
    "visible_desktop" BOOLEAN NOT NULL DEFAULT true,
    "visible_mobile_web" BOOLEAN NOT NULL DEFAULT true,
    "visible_mobile_app" BOOLEAN NOT NULL DEFAULT true,
    "auto_slide_duration_seconds" INTEGER NOT NULL DEFAULT 5,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "header_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_home_sections_visibility" ON "home_sections"("is_published", "sort_order");

-- CreateIndex
CREATE INDEX "idx_home_section_designs_section" ON "home_section_designs"("home_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_home_section_designs_section_design" ON "home_section_designs"("home_section_id", "design_id");

-- CreateIndex
CREATE INDEX "idx_advertisements_active_window" ON "advertisements"("is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_header_media_active_priority" ON "header_media"("is_active", "priority");

-- AddForeignKey
ALTER TABLE "home_section_designs" ADD CONSTRAINT "home_section_designs_home_section_id_fkey" FOREIGN KEY ("home_section_id") REFERENCES "home_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_section_designs" ADD CONSTRAINT "home_section_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_target_category_id_fkey" FOREIGN KEY ("target_category_id") REFERENCES "design_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisement_target_designs" ADD CONSTRAINT "advertisement_target_designs_advertisement_id_fkey" FOREIGN KEY ("advertisement_id") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisement_target_designs" ADD CONSTRAINT "advertisement_target_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

