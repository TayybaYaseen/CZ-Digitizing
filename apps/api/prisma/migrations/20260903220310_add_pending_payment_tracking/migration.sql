-- CreateTable
CREATE TABLE "pending_subscription_payments" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "paypal_order_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_credit_purchases" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "package_id" BIGINT NOT NULL,
    "paypal_order_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_subscription_payments_paypal_order_id_key" ON "pending_subscription_payments"("paypal_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_subscription_payments_stripe_payment_intent_id_key" ON "pending_subscription_payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_credit_purchases_paypal_order_id_key" ON "pending_credit_purchases"("paypal_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_credit_purchases_stripe_payment_intent_id_key" ON "pending_credit_purchases"("stripe_payment_intent_id");

