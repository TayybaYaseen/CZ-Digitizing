-- CreateTable
CREATE TABLE "allowed_file_formats" (
    "id" BIGSERIAL NOT NULL,
    "extension" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_file_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_files" (
    "id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "file_format" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "upload_hash" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "content_validated" BOOLEAN NOT NULL DEFAULT false,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "superseded_by_file_id" BIGINT,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_authorized_files" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "design_file_id" BIGINT NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "first_download_at" TIMESTAMP(3),
    "last_download_at" TIMESTAMP(3),
    "max_download_attempts" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_authorized_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_file_formats_extension_key" ON "allowed_file_formats"("extension");

-- CreateIndex
CREATE UNIQUE INDEX "design_files_superseded_by_file_id_key" ON "design_files"("superseded_by_file_id");

-- CreateIndex
CREATE INDEX "idx_design_files_design" ON "design_files"("design_id");

-- CreateIndex
CREATE INDEX "idx_design_files_upload_hash" ON "design_files"("upload_hash");

-- CreateIndex
CREATE INDEX "idx_customer_authorized_files_order" ON "customer_authorized_files"("order_id");

-- CreateIndex
CREATE INDEX "idx_customer_authorized_files_customer" ON "customer_authorized_files"("customer_id");

-- AddForeignKey
ALTER TABLE "design_files" ADD CONSTRAINT "design_files_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_files" ADD CONSTRAINT "design_files_superseded_by_file_id_fkey" FOREIGN KEY ("superseded_by_file_id") REFERENCES "design_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_authorized_files" ADD CONSTRAINT "customer_authorized_files_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_authorized_files" ADD CONSTRAINT "customer_authorized_files_design_file_id_fkey" FOREIGN KEY ("design_file_id") REFERENCES "design_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateCheckConstraint
-- docs/specs/2026-08-28-05-private-file-management.md AC-2 — load-bearing DB-level backstop: a
-- write that tries to set file_format='EMB' with is_private=false is rejected by Postgres itself,
-- not merely by application code. Not expressible in Prisma's schema DSL (5.x has no @@check), so
-- it is hand-appended here per this repo's established pattern for DB-level invariants that fall
-- outside what `prisma migrate diff` can generate on its own.
ALTER TABLE "design_files" ADD CONSTRAINT "emb_never_public" CHECK (NOT ("file_format" = 'EMB' AND NOT "is_private"));

-- Seed the allowed-format registry (AC-13/AC-14). EMB is seeded locked+private and the service
-- layer (FileFormatService) refuses any write that would flip either flag on a locked row.
INSERT INTO "allowed_file_formats" ("extension", "display_name", "is_private", "is_locked", "is_active", "max_file_size_mb", "updated_at") VALUES
    ('DST', 'Tajima DST', false, false, true, 50, CURRENT_TIMESTAMP),
    ('PES', 'Brother PES', false, false, true, 50, CURRENT_TIMESTAMP),
    ('JEF', 'Janome JEF', false, false, true, 50, CURRENT_TIMESTAMP),
    ('EXP', 'Melco EXP', false, false, true, 50, CURRENT_TIMESTAMP),
    ('VP3', 'Husqvarna Viking VP3', false, false, true, 50, CURRENT_TIMESTAMP),
    ('EMB', 'Wilcom EMB (permanently private)', true, true, true, 50, CURRENT_TIMESTAMP);
