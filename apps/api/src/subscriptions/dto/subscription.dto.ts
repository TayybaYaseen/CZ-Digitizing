import type { BillingPeriod, CustomerSubscription, SubscriptionPlan, SubscriptionStatus } from '../../generated/prisma';

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  billingPeriod: BillingPeriod;
  pricePkr: number;
  monthlyCredits: number;
  // null = unlimited logo/design-file downloads under this plan.
  logoLimit: number | null;
  perks: string[];
  isBestValue: boolean;
  isPublished: boolean;
}

export interface CustomerSubscriptionDto {
  id: string;
  plan: SubscriptionPlanDto;
  status: SubscriptionStatus;
  autoRenew: boolean;
  startDate: string;
  renewalDate: string;
  endDate: string | null;
  logosUsed: number;
  logosRemaining: number | null; // null = unlimited (plan.logoLimit is null)
}

// Admin-only view (SubscriptionsAdminController's usage endpoint) — one row per active/lapsed
// subscriber, so Admin can see exactly how many logo downloads each customer has left without
// opening each customer's account individually.
export interface SubscriptionUsageDto {
  customerId: string;
  customerEmail: string;
  planName: string;
  status: SubscriptionStatus;
  logoLimit: number | null;
  logosUsed: number;
  logosRemaining: number | null;
}

export function toSubscriptionPlanDto(plan: SubscriptionPlan): SubscriptionPlanDto {
  return {
    id: plan.id.toString(),
    name: plan.name,
    billingPeriod: plan.billingPeriod,
    pricePkr: Number(plan.pricePkr),
    monthlyCredits: plan.monthlyCredits,
    logoLimit: plan.logoLimit,
    perks: plan.perks,
    isBestValue: plan.isBestValue,
    isPublished: plan.isPublished,
  };
}

export function toCustomerSubscriptionDto(sub: CustomerSubscription & { plan: SubscriptionPlan }): CustomerSubscriptionDto {
  return {
    id: sub.id.toString(),
    plan: toSubscriptionPlanDto(sub.plan),
    status: sub.status,
    autoRenew: sub.autoRenew,
    startDate: sub.startDate.toISOString(),
    renewalDate: sub.renewalDate.toISOString(),
    endDate: sub.endDate?.toISOString() ?? null,
    logosUsed: sub.logosUsed,
    logosRemaining: sub.plan.logoLimit === null ? null : Math.max(0, sub.plan.logoLimit - sub.logosUsed),
  };
}
