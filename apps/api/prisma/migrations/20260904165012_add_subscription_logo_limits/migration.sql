-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'subscription_logo_limit_low';

-- AlterTable
ALTER TABLE "customer_subscriptions" ADD COLUMN     "logo_limit_warned_at" TIMESTAMP(3),
ADD COLUMN     "logos_used" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "logo_limit" INTEGER;
