-- CreateTable
CREATE TABLE "design_categories" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_subcategories" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_category_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_category_assignments" (
    "design_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,

    CONSTRAINT "design_category_assignments_pkey" PRIMARY KEY ("design_id","category_id")
);

-- CreateTable
CREATE TABLE "designs" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "preview_image_url" TEXT NOT NULL,
    "gallery_image_urls" TEXT[],
    "subcategory_id" BIGINT,
    "vector_image_url" TEXT,
    "vector_video_url" TEXT,
    "embroidery_image_url" TEXT,
    "embroidery_video_url" TEXT,
    "auto_swap_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_pkr" DECIMAL(10,2) NOT NULL,
    "sale_price_pkr" DECIMAL(10,2),
    "discount_badge" TEXT,
    "stitch_count" INTEGER,
    "thread_color_count" INTEGER,
    "thread_color_changes" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_sizes" (
    "id" BIGSERIAL NOT NULL,
    "design_id" BIGINT NOT NULL,
    "size_label" TEXT NOT NULL,
    "size_width_mm" DECIMAL(8,2) NOT NULL,
    "size_height_mm" DECIMAL(8,2) NOT NULL,
    "size_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "design_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_categories_slug_key" ON "design_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "design_subcategories_slug_key" ON "design_subcategories"("slug");

-- CreateIndex
CREATE INDEX "idx_design_subcategories_parent" ON "design_subcategories"("parent_category_id");

-- CreateIndex
CREATE INDEX "idx_designs_subcategory" ON "designs"("subcategory_id");

-- CreateIndex
CREATE INDEX "idx_designs_published" ON "designs"("is_published");

-- CreateIndex
CREATE INDEX "idx_design_sizes_design" ON "design_sizes"("design_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_favorites_customer_design" ON "favorites"("customer_id", "design_id");

-- AddForeignKey
ALTER TABLE "design_subcategories" ADD CONSTRAINT "design_subcategories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "design_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_category_assignments" ADD CONSTRAINT "design_category_assignments_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_category_assignments" ADD CONSTRAINT "design_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "design_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "design_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_sizes" ADD CONSTRAINT "design_sizes_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

