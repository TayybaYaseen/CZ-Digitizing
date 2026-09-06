-- CreateEnum
CREATE TYPE "ServiceMainType" AS ENUM ('embroidery_digitizing', 'vector_art');

-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'services';

-- CreateTable
CREATE TABLE "services" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ServiceMainType" NOT NULL,
    "parent_service_id" BIGINT,
    "description" TEXT NOT NULL,
    "visual_image_url" TEXT NOT NULL,
    "applications" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "related_design_category_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "idx_services_parent" ON "services"("parent_service_id");

-- CreateIndex
CREATE INDEX "idx_services_type" ON "services"("type");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_parent_service_id_fkey" FOREIGN KEY ("parent_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_related_design_category_id_fkey" FOREIGN KEY ("related_design_category_id") REFERENCES "design_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
