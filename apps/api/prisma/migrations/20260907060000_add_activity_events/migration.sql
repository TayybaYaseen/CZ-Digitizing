-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('VIEWED', 'ADDED_TO_CART', 'REMOVED_FROM_CART', 'PURCHASED', 'PAID', 'DOWNLOADED');

-- CreateEnum
CREATE TYPE "ActivityEventSource" AS ENUM ('web', 'mobile');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "event_type" "ActivityEventType" NOT NULL,
    "source" "ActivityEventSource" NOT NULL DEFAULT 'web',
    "design_id" BIGINT,
    "order_id" BIGINT,
    "cart_item_id" TEXT,
    "file_id" BIGINT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "id" BIGSERIAL NOT NULL,
    "primary_user_id" BIGINT NOT NULL,
    "member_user_id" BIGINT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_idempotency_key_key" ON "activity_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_activity_events_customer_created" ON "activity_events"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_account_members_member" ON "account_members"("member_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_members_primary_member" ON "account_members"("primary_user_id", "member_user_id");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "design_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

