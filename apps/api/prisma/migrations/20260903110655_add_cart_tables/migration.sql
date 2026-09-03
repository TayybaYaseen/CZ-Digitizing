-- CreateEnum
CREATE TYPE "CartItemStatus" AS ENUM ('active', 'saved_for_later');

-- CreateTable
CREATE TABLE "carts" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT,
    "guest_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" BIGSERIAL NOT NULL,
    "cart_id" BIGINT NOT NULL,
    "design_id" BIGINT,
    "bundle_id" BIGINT,
    "size_id" BIGINT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "CartItemStatus" NOT NULL DEFAULT 'active',
    "price_at_add_pkr" DECIMAL(10,2) NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_customer_id_key" ON "carts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guest_session_id_key" ON "carts"("guest_session_id");

-- CreateIndex
CREATE INDEX "idx_cart_items_cart" ON "cart_items"("cart_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "design_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "design_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK: a cart_items row is a design line or a bundle line, never both/neither — same posture
-- as design_files' emb_never_public (AC-1/AC-2, docs/specs/2026-08-28-07-shopping-cart-checkout.md).
-- Prisma's schema DSL has no @@check clause in this Prisma version (5.x), so this is hand-appended.
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_item_exactly_one_of_design_or_bundle"
  CHECK ((design_id IS NOT NULL AND bundle_id IS NULL) OR (design_id IS NULL AND bundle_id IS NOT NULL));

-- CHECK: a cart itself is a customer cart or a guest cart, never both/neither — mirrors the
-- exactly-one-of shape above, enforced the same way at the DB level.
ALTER TABLE "carts" ADD CONSTRAINT "cart_exactly_one_of_customer_or_guest"
  CHECK ((customer_id IS NOT NULL AND guest_session_id IS NULL) OR (customer_id IS NULL AND guest_session_id IS NOT NULL));

