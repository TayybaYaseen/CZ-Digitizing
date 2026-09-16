-- docs/portfolio-spec.md §10.1 (Professional Portfolio enhancement of A-012f) — additive,
-- nullable/defaulted columns for real work-sample metadata only. No CV/biography content is
-- stored in this table (see the model's own comment in schema.prisma).

-- AlterTable
ALTER TABLE "portfolio_items"
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "original_artwork_url" TEXT,
  ADD COLUMN "embroidery_result_url" TEXT,
  ADD COLUMN "close_up_image_url" TEXT,
  ADD COLUMN "before_image_url" TEXT,
  ADD COLUMN "after_image_url" TEXT,
  ADD COLUMN "software_used" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "embroidery_type" TEXT,
  ADD COLUMN "stitch_count" INTEGER,
  ADD COLUMN "size_label" TEXT,
  ADD COLUMN "machine_format" TEXT,
  ADD COLUMN "project_notes" TEXT,
  ADD COLUMN "media_alt_texts" JSONB NOT NULL DEFAULT '{}';
