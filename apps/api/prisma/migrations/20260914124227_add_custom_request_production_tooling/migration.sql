-- CreateTable
CREATE TABLE "custom_request_tasks" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "custom_request_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_time_entries" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "designer_id" BIGINT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_production_files" (
    "id" BIGSERIAL NOT NULL,
    "custom_request_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_format" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "upload_hash" TEXT NOT NULL,
    "note" TEXT,
    "uploaded_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_production_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_custom_request_tasks_request" ON "custom_request_tasks"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_custom_request_time_entries_request" ON "custom_request_time_entries"("custom_request_id");

-- CreateIndex
CREATE INDEX "idx_custom_request_production_files_request" ON "custom_request_production_files"("custom_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_custom_request_production_files_version" ON "custom_request_production_files"("custom_request_id", "version");

-- AddForeignKey
ALTER TABLE "custom_request_tasks" ADD CONSTRAINT "custom_request_tasks_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_tasks" ADD CONSTRAINT "custom_request_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_time_entries" ADD CONSTRAINT "custom_request_time_entries_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_time_entries" ADD CONSTRAINT "custom_request_time_entries_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_production_files" ADD CONSTRAINT "custom_request_production_files_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_production_files" ADD CONSTRAINT "custom_request_production_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
