-- CreateTable
CREATE TABLE "design_bundles" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "preview_image_url" TEXT,
    "price_pkr" DECIMAL(10,2) NOT NULL,
    "sale_price_pkr" DECIMAL(10,2),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "design_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_designs" (
    "id" BIGSERIAL NOT NULL,
    "bundle_id" BIGINT NOT NULL,
    "design_id" BIGINT NOT NULL,
    "sort_order" INTEGER,
    "price_override_pkr" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_bundle_rules" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "required_design_count" INTEGER NOT NULL,
    "bundle_price_pkr" DECIMAL(10,2) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_bundle_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_design_bundles_published" ON "design_bundles"("is_published");

-- CreateIndex
CREATE INDEX "idx_bundle_designs_design" ON "bundle_designs"("design_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bundle_designs_bundle_design" ON "bundle_designs"("bundle_id", "design_id");

-- CreateIndex
CREATE INDEX "idx_dynamic_bundle_rules_category" ON "dynamic_bundle_rules"("category_id");

-- AddForeignKey
ALTER TABLE "bundle_designs" ADD CONSTRAINT "bundle_designs_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "design_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_designs" ADD CONSTRAINT "bundle_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_bundle_rules" ADD CONSTRAINT "dynamic_bundle_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "design_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

