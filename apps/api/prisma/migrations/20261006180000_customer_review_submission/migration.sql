-- A-026 Customer Review Submission & Admin Moderation
-- (docs/specs/2026-10-06-22-customer-review-submission.md §25)

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'review_submitted';

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "custom_request_id" BIGINT,
ADD COLUMN     "image_content_type" TEXT,
ADD COLUMN     "image_original_filename" TEXT,
ADD COLUMN     "image_storage_path" TEXT,
ADD COLUMN     "original_feedback" TEXT,
ALTER COLUMN "country" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_testimonials_custom_request" ON "testimonials"("custom_request_id");

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (spec §15): customer submissions used to store the placeholder 'Not specified', which the
-- public card then displayed. Country is optional now, so the placeholder becomes NULL.
UPDATE "testimonials" SET "country" = NULL WHERE "source" = 'customer_submitted' AND "country" = 'Not specified';

-- Backfill (spec §10, defect D-f): a row could be is_published = true while not approved. Such rows were
-- already invisible publicly (the public query also requires approved), so unpublishing changes nothing
-- visible, and it lets the invariant below hold.
UPDATE "testimonials" SET "is_published" = false WHERE "is_published" = true AND "moderation_status" <> 'approved';

-- Spec §10 — published implies approved.
ALTER TABLE "testimonials" ADD CONSTRAINT "chk_testimonials_published_is_approved"
  CHECK (NOT "is_published" OR "moderation_status" = 'approved');

-- Spec §25 — the image columns are set together or not at all.
ALTER TABLE "testimonials" ADD CONSTRAINT "chk_testimonials_image_pair"
  CHECK (("image_storage_path" IS NULL) = ("image_content_type" IS NULL));

-- Spec §25 — a review links to at most one purchased item.
ALTER TABLE "testimonials" ADD CONSTRAINT "chk_testimonials_single_link"
  CHECK ("order_id" IS NULL OR "custom_request_id" IS NULL);
