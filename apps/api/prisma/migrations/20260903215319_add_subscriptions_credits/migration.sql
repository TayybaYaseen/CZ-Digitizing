-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'lapsed');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('purchase', 'usage', 'refund', 'adjustment', 'grant');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "credits_used" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "billing_period" "BillingPeriod" NOT NULL,
    "price_pkr" DECIMAL(10,2) NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "perks" TEXT[],
    "is_best_value" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3) NOT NULL,
    "renewal_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "failed_renewal_count" INTEGER NOT NULL DEFAULT 0,
    "last_renewal_failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_credit_grants" (
    "id" BIGSERIAL NOT NULL,
    "customer_subscription_id" BIGINT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credit_transaction_id" BIGINT NOT NULL,

    CONSTRAINT "subscription_credit_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "bonus_credits" INTEGER NOT NULL DEFAULT 0,
    "price_pkr" DECIMAL(10,2) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credits" (
    "customer_id" BIGINT NOT NULL,
    "total_credits" INTEGER NOT NULL DEFAULT 0,
    "available_credits" INTEGER NOT NULL DEFAULT 0,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "related_order_id" BIGINT,
    "gift_counterparty_id" BIGINT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_subscription_plans_published" ON "subscription_plans"("is_published");

-- CreateIndex
CREATE UNIQUE INDEX "customer_subscriptions_customer_id_key" ON "customer_subscriptions"("customer_id");

-- CreateIndex
CREATE INDEX "idx_customer_subscriptions_renewal" ON "customer_subscriptions"("subscription_status", "renewal_date");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_credit_grants_credit_transaction_id_key" ON "subscription_credit_grants"("credit_transaction_id");

-- CreateIndex
CREATE INDEX "idx_subscription_credit_grants_subscription" ON "subscription_credit_grants"("customer_subscription_id");

-- CreateIndex
CREATE INDEX "idx_credit_packages_published" ON "credit_packages"("is_published");

-- CreateIndex
CREATE INDEX "idx_credit_transactions_customer" ON "credit_transactions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_credit_transactions_order" ON "credit_transactions"("related_order_id");

-- AddForeignKey
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_credit_grants" ADD CONSTRAINT "subscription_credit_grants_customer_subscription_id_fkey" FOREIGN KEY ("customer_subscription_id") REFERENCES "customer_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_credit_grants" ADD CONSTRAINT "subscription_credit_grants_credit_transaction_id_fkey" FOREIGN KEY ("credit_transaction_id") REFERENCES "credit_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_gift_counterparty_id_fkey" FOREIGN KEY ("gift_counterparty_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
