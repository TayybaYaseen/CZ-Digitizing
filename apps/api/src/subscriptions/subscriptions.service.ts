import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import { CreditsService } from '../credits/credits.service';
import type { BillingPeriod, CustomerSubscription, Prisma, SubscriptionPlan } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePlanDto, SubscriptionPlanWriteDto } from './dto/subscription-write.dto';
import {
  CustomerSubscriptionDto,
  SubscriptionPlanDto,
  SubscriptionUsageDto,
  toCustomerSubscriptionDto,
  toSubscriptionPlanDto,
} from './dto/subscription.dto';
import { computeRenewalDate } from './renewal-date.util';

// Notification fires once per billing cycle, the first time remaining downloads drops to this
// value or below (never on every download after — logoLimitWarnedAt gates the re-fire, reset
// alongside logosUsed on each renewal grant).
export const LOW_LOGO_LIMIT_THRESHOLD = 3;

// docs/specs/2026-08-28-09-subscriptions-credits.md §3/§4 (aspect A-015a). Payment is BANK TRANSFER
// ONLY: the first payment and every renewal are ordinary bank-transfer orders (created by
// PurchasesService, activated here by activateFromOrder once an Admin approves the receipt).
// Dunning cadence (spec §8 risk #3, left Open by the spec itself): resolved as 3 missed renewal
// reminders over a 3-day grace period before lapsing (PurchasesService.attemptRenewal).
export const RENEWAL_MAX_RETRIES = 3;
export const RENEWAL_GRACE_PERIOD_DAYS = 3;

// What activating a subscription changed — used only to word the customer's notification.
export interface SubscriptionActivation {
  planName: string;
  renewalDate: Date;
  isRenewal: boolean;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationService,
  ) {}

  async listPublicPlans(): Promise<SubscriptionPlanDto[]> {
    const rows = await this.prisma.subscriptionPlan.findMany({ where: { isPublished: true }, orderBy: { pricePkr: 'asc' } });
    return rows.map(toSubscriptionPlanDto);
  }

  async listAdminPlans(): Promise<SubscriptionPlanDto[]> {
    const rows = await this.prisma.subscriptionPlan.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toSubscriptionPlanDto);
  }

  async createPlan(dto: SubscriptionPlanWriteDto): Promise<SubscriptionPlanDto> {
    const created = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        billingPeriod: dto.billingPeriod as BillingPeriod,
        pricePkr: dto.pricePkr,
        monthlyCredits: dto.monthlyCredits,
        logoLimit: dto.logoLimit ?? null,
        perks: dto.perks,
        isBestValue: dto.isBestValue,
        isPublished: dto.isPublished,
      },
    });
    return toSubscriptionPlanDto(created);
  }

  async updatePlan(id: string, dto: SubscriptionPlanWriteDto): Promise<SubscriptionPlanDto> {
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        billingPeriod: dto.billingPeriod as BillingPeriod,
        pricePkr: dto.pricePkr,
        monthlyCredits: dto.monthlyCredits,
        logoLimit: dto.logoLimit ?? null,
        perks: dto.perks,
        isBestValue: dto.isBestValue,
        isPublished: dto.isPublished,
      },
    });
    return toSubscriptionPlanDto(updated);
  }

  // Hard-deletes a plan, but only when nothing references it — CustomerSubscription.planId is a
  // Restrict FK (schema.prisma), so the DB itself would already refuse this for any customer who
  // ever subscribed to the plan (active, cancelled, or lapsed — the row is kept as history). Rather
  // than let that surface as an opaque DB constraint error, check first and return a clear CONFLICT
  // telling Admin to unpublish instead — the existing, always-safe way to retire a plan no one can
  // subscribe to anymore without touching subscribers' historical records.
  async deletePlan(id: string): Promise<void> {
    const planId = BigInt(id);
    const subscriberCount = (await this.prisma.customerSubscription.count({ where: { planId } })) + (await this.prisma.orderItem.count({ where: { subscriptionPlanId: planId } }));
    if (subscriberCount > 0) {
      throw new ApiException(
        'CONFLICT',
        409,
        `Cannot delete "${(await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } }))?.name ?? 'this plan'}" — it is referenced by ${subscriberCount} subscription/order record(s). Unpublish it instead to stop new signups.`,
      );
    }
    await this.prisma.subscriptionPlan.delete({ where: { id: planId } });
  }

  // Admin visibility — one row per subscriber showing exactly how many logo downloads they've
  // used/have left this cycle, so Admin never has to open each customer's account individually.
  async listAdminUsage(): Promise<SubscriptionUsageDto[]> {
    const rows = await this.prisma.customerSubscription.findMany({
      include: { plan: true, customer: { select: { email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      customerId: row.customerId.toString(),
      customerEmail: row.customer.email,
      planName: row.plan.name,
      status: row.status,
      logoLimit: row.plan.logoLimit,
      logosUsed: row.logosUsed,
      logosRemaining: row.plan.logoLimit === null ? null : Math.max(0, row.plan.logoLimit - row.logosUsed),
    }));
  }

  // Consumes one logo/design-file download from the customer's active subscription allotment.
  // Called by the download flow before releasing the file (mirrors CustomerFilesService's own
  // "check limit, then increment" shape). Throws SUBSCRIPTION_LOGO_LIMIT_REACHED once logosUsed
  // reaches plan.logoLimit; a plan with logoLimit=null never throws (unlimited). Fires the
  // low-balance notification exactly once per cycle, the first time remaining drops to
  // LOW_LOGO_LIMIT_THRESHOLD or below.
  async consumeLogoDownload(customerId: bigint): Promise<{ logosUsed: number; logosRemaining: number | null }> {
    const sub = await this.prisma.customerSubscription.findUnique({ where: { customerId }, include: { plan: true } });
    if (!sub || sub.status !== 'active') throw new ApiException('RESOURCE_NOT_FOUND', 404, 'No active subscription found');

    const limit = sub.plan.logoLimit;
    if (limit !== null && sub.logosUsed >= limit) {
      throw new ApiException('SUBSCRIPTION_LOGO_LIMIT_REACHED', 422, 'Your subscription\'s monthly logo download limit has been reached');
    }

    const logosUsed = sub.logosUsed + 1;
    const remaining = limit === null ? null : Math.max(0, limit - logosUsed);
    const shouldWarn = remaining !== null && remaining <= LOW_LOGO_LIMIT_THRESHOLD && !sub.logoLimitWarnedAt;

    await this.prisma.customerSubscription.update({
      where: { customerId },
      data: { logosUsed, ...(shouldWarn ? { logoLimitWarnedAt: new Date() } : {}) },
    });

    if (shouldWarn) {
      await this.notifications.notify({
        recipientUserId: customerId.toString(),
        type: 'subscription_logo_limit_low',
        title: 'Logo download limit running low',
        message:
          remaining === 0
            ? `You've used all ${limit} logo downloads on your "${sub.plan.name}" plan this cycle. Your allowance refreshes on renewal.`
            : `You have ${remaining} logo download${remaining === 1 ? '' : 's'} left on your "${sub.plan.name}" plan this cycle.`,
        channels: ['email', 'in_app'],
      });
    }

    return { logosUsed, logosRemaining: remaining };
  }

  async getCurrent(customerId: bigint): Promise<CustomerSubscriptionDto> {
    const sub = await this.prisma.customerSubscription.findUnique({ where: { customerId }, include: { plan: true } });
    if (!sub) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'No subscription found');
    return toCustomerSubscriptionDto(sub);
  }

  // AC-2 (part 2)/AC-3 — called from OrdersService inside the transaction that approves a subscription
  // order's bank-transfer receipt (first payment or renewal alike: both are "a payment for this
  // customer's plan was confirmed, extend their access"). Because that approval is single-winner,
  // this runs exactly once per order. Creates the subscription on the first payment, otherwise
  // reactivates/extends the existing row, then grants the plan's monthly credits and resets the logo
  // allowance. Returns what the customer notification needs.
  async activateFromOrder(tx: Prisma.TransactionClient, customerId: bigint, planId: bigint): Promise<SubscriptionActivation> {
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
    const now = new Date();
    const renewalDate = computeRenewalDate(now, plan.billingPeriod);

    const existing = await tx.customerSubscription.findUnique({ where: { customerId } });
    const sub = existing
      ? await tx.customerSubscription.update({
          where: { customerId },
          data: { planId: plan.id, status: 'active', autoRenew: true, renewalDate, endDate: null, failedRenewalCount: 0, lastRenewalFailedAt: null },
        })
      : await tx.customerSubscription.create({
          data: { customerId, planId: plan.id, status: 'active', autoRenew: true, startDate: now, renewalDate },
        });

    await this.grantMonthlyCredits(tx, sub, plan);
    return { planName: plan.name, renewalDate, isRenewal: existing !== null };
  }

  // AC-4 — cancellation leaves renewalDate as the already-paid access boundary (copied into
  // endDate so getCurrent()/perk-gating callers have a stable field to check against without
  // needing to know "cancelled means renewalDate is actually the cutoff now").
  async cancel(customerId: bigint): Promise<CustomerSubscriptionDto> {
    const sub = await this.prisma.customerSubscription.findUnique({ where: { customerId }, include: { plan: true } });
    if (!sub) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'No subscription found');
    const updated = await this.prisma.customerSubscription.update({
      where: { customerId },
      data: { status: 'cancelled', autoRenew: false, endDate: sub.renewalDate },
      include: { plan: true },
    });
    return toCustomerSubscriptionDto(updated);
  }

  // AC-9 — mid-cycle upgrade/downgrade with proration. The unused-time credit on the current plan
  // (remaining days / period length * current price) offsets the new plan's price for the
  // remainder of the cycle; renewalDate is left as-is (spec: "the next charge reflects the new
  // plan" — the *amount* changes, not the date) and monthlyCredits going forward come from the
  // new plan starting at the next renewal grant.
  async changePlan(customerId: bigint, dto: ChangePlanDto): Promise<{ subscription: CustomerSubscriptionDto; proratedChargePkr: number }> {
    const sub = await this.prisma.customerSubscription.findUnique({ where: { customerId }, include: { plan: true } });
    if (!sub || sub.status !== 'active') throw new ApiException('RESOURCE_NOT_FOUND', 404, 'No active subscription found');
    const newPlan = await this.prisma.subscriptionPlan.findUnique({ where: { id: BigInt(dto.planId) } });
    if (!newPlan || !newPlan.isPublished) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Subscription plan not found');

    const periodDays = sub.plan.billingPeriod === 'monthly' ? 30 : 365;
    const now = Date.now();
    const cycleStart = sub.renewalDate.getTime() - periodDays * 86_400_000;
    const remainingDays = Math.max(0, Math.round((sub.renewalDate.getTime() - now) / 86_400_000));
    const unusedCreditPkr = (Number(sub.plan.pricePkr) / periodDays) * remainingDays;
    const newPlanProratedPkr = (Number(newPlan.pricePkr) / periodDays) * remainingDays;
    const proratedChargePkr = Math.max(0, Math.round((newPlanProratedPkr - unusedCreditPkr) * 100) / 100);
    void cycleStart;

    const updated = await this.prisma.customerSubscription.update({
      where: { customerId },
      data: { planId: newPlan.id },
      include: { plan: true },
    });

    await this.notifications.notify({
      recipientUserId: customerId.toString(),
      type: 'subscription_renewal',
      title: 'Subscription plan changed',
      message: `Your subscription is now "${newPlan.name}". ${proratedChargePkr > 0 ? `A prorated charge of ${proratedChargePkr} PKR applies for the rest of this cycle.` : ''}`,
      channels: ['email', 'in_app'],
    });

    return { subscription: toCustomerSubscriptionDto(updated), proratedChargePkr };
  }

  // AC-3 — the monthly grant. Runs only from activateFromOrder(), i.e. once per approved payment
  // (the approval's single-winner claim is what makes it idempotent); SubscriptionCreditGrant links
  // the grant to its ledger entry (creditTransactionId is unique).
  private async grantMonthlyCredits(tx: Prisma.TransactionClient, sub: CustomerSubscription, plan: SubscriptionPlan): Promise<void> {
    const creditTransactionId = await this.credits.grant(tx, sub.customerId, plan.monthlyCredits, `Monthly grant for subscription plan "${plan.name}"`);
    await tx.subscriptionCreditGrant.create({ data: { customerSubscriptionId: sub.id, creditTransactionId } });
    // AC-3/AC-8 for logos, same cycle boundary as the credit grant above — a fresh cycle means a
    // fresh logo allowance and a fresh chance to hit (and be re-warned about) the low threshold.
    await tx.customerSubscription.update({ where: { id: sub.id }, data: { logosUsed: 0, logoLimitWarnedAt: null } });
  }
}
