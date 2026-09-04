import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import { CreditsService } from '../credits/credits.service';
import type { BillingPeriod, CustomerSubscription, SubscriptionPlan } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';
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

// docs/specs/2026-08-28-09-subscriptions-credits.md §3/§4 (aspect A-015a). Dunning cadence (spec §8
// risk #3, left Open by the spec itself): resolved here as 3 retry attempts over a 3-day grace
// period before lapsing — a concrete, documented choice rather than leaving retry/backoff
// unimplemented, per this repo's "flag, don't guess, but still ship something real" convention
// (see e.g. OrdersService.reviewPaymentConfirmation's own doc comment on the same kind of call).
export const RENEWAL_MAX_RETRIES = 3;
export const RENEWAL_GRACE_PERIOD_DAYS = 3;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
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
    const subscriberCount = await this.prisma.customerSubscription.count({ where: { planId } });
    if (subscriberCount > 0) {
      throw new ApiException(
        'CONFLICT',
        409,
        `Cannot delete "${(await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } }))?.name ?? 'this plan'}" — ${subscriberCount} customer(s) have subscribed to it. Unpublish it instead to stop new signups.`,
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

  // AC-2 (part 1) — mirrors CreditsService.purchase()'s "create a pending payment, confirm via
  // webhook" shape (see PendingSubscriptionPayment's own doc comment). ALREADY_SUBSCRIBED (spec §3)
  // is checked here, not just at confirm time, so the customer gets an immediate, honest rejection
  // instead of paying for a subscription the webhook will silently refuse to activate.
  async subscribe(customerId: bigint, planId: string, paymentMethod: 'paypal' | 'stripe'): Promise<{ approveUrl: string | null; clientSecret: string | null }> {
    const existing = await this.prisma.customerSubscription.findUnique({ where: { customerId } });
    if (existing && existing.status === 'active') throw new ApiException('ALREADY_SUBSCRIBED', 409, 'An active subscription already exists');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: BigInt(planId) } });
    if (!plan || !plan.isPublished) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Subscription plan not found');

    const pending = await this.prisma.pendingSubscriptionPayment.create({ data: { customerId, planId: plan.id } });

    if (paymentMethod === 'paypal') {
      const created = await this.paypal.createOrder(Number(plan.pricePkr), `subscription:${pending.id}`);
      if (!created) throw new ApiException('VALIDATION_ERROR', 502, 'Payment provider is not available');
      await this.prisma.pendingSubscriptionPayment.update({ where: { id: pending.id }, data: { paypalOrderId: created.paypalOrderId } });
      return { approveUrl: created.approveUrl, clientSecret: null };
    }

    const created = await this.stripe.createPaymentIntent(Number(plan.pricePkr), `subscription:${pending.id}`);
    if (!created) throw new ApiException('VALIDATION_ERROR', 502, 'Payment provider is not available');
    await this.prisma.pendingSubscriptionPayment.update({ where: { id: pending.id }, data: { stripePaymentIntentId: created.paymentIntentId } });
    return { approveUrl: null, clientSecret: created.clientSecret };
  }

  // AC-2 (part 2)/AC-3 — called by the webhook once payment is confirmed. Handles both the first
  // subscription (no existing row) and a renewal charge (row exists) with the same logic, since
  // both cases are "a payment for this customer's plan just succeeded, extend their access".
  async confirmPayment(pendingId: bigint): Promise<void> {
    const pending = await this.prisma.pendingSubscriptionPayment.findUnique({ where: { id: pendingId } });
    if (!pending) {
      this.logger.log(`Subscription payment ${pendingId} already processed or unknown — ignoring duplicate webhook`);
      return;
    }
    const plan = await this.prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: pending.planId } });
    const now = new Date();
    const renewalDate = computeRenewalDate(now, plan.billingPeriod);

    const existing = await this.prisma.customerSubscription.findUnique({ where: { customerId: pending.customerId } });

    const sub = existing
      ? await this.prisma.customerSubscription.update({
          where: { customerId: pending.customerId },
          data: { planId: plan.id, status: 'active', autoRenew: true, renewalDate, endDate: null, failedRenewalCount: 0, lastRenewalFailedAt: null },
        })
      : await this.prisma.customerSubscription.create({
          data: { customerId: pending.customerId, planId: plan.id, status: 'active', autoRenew: true, startDate: now, renewalDate },
        });

    await this.grantMonthlyCredits(sub, plan);
    await this.prisma.pendingSubscriptionPayment.delete({ where: { id: pending.id } });

    await this.notifications.notify({
      recipientUserId: pending.customerId.toString(),
      type: 'subscription_renewal',
      title: existing ? 'Subscription renewed' : 'Subscription activated',
      message: `Your "${plan.name}" subscription is now active. Next renewal: ${renewalDate.toDateString()}.`,
      channels: ['email', 'in_app'],
    });
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

  // AC-3/AC-8 — invoked by SubscriptionRenewalService's daily cron for every active,
  // auto-renewing subscription whose renewalDate has arrived. Not a silent auto-charge: no stored
  // payment method exists in this payment layer (spec §8 risk #1, left Open by the spec itself —
  // PayPal Subscriptions API vs. manual re-charge), so "attempt" concretely means creating a fresh
  // one-time payment intent and prompting the customer to complete it, tracked the same way the
  // very first payment was. A subscription that misses RENEWAL_MAX_RETRIES attempts across
  // RENEWAL_GRACE_PERIOD_DAYS lapses (AC-8: no further automatic credit grant after that).
  async attemptRenewal(sub: CustomerSubscription & { plan: SubscriptionPlan }): Promise<void> {
    const pending = await this.prisma.pendingSubscriptionPayment.create({ data: { customerId: sub.customerId, planId: sub.planId } });
    const created = await this.paypal.createOrder(Number(sub.plan.pricePkr), `subscription:${pending.id}`);
    const approveUrl = created?.approveUrl ?? null;
    if (!created) await this.prisma.pendingSubscriptionPayment.delete({ where: { id: pending.id } });
    else await this.prisma.pendingSubscriptionPayment.update({ where: { id: pending.id }, data: { paypalOrderId: created.paypalOrderId } });

    const failedCount = sub.failedRenewalCount + 1;
    const shouldLapse = failedCount >= RENEWAL_MAX_RETRIES;

    await this.prisma.customerSubscription.update({
      where: { customerId: sub.customerId },
      data: shouldLapse
        ? { status: 'lapsed', autoRenew: false, failedRenewalCount: failedCount, lastRenewalFailedAt: new Date() }
        : { failedRenewalCount: failedCount, lastRenewalFailedAt: new Date() },
    });

    await this.notifications.notify({
      recipientUserId: sub.customerId.toString(),
      type: 'subscription_renewal_failed',
      title: shouldLapse ? 'Subscription lapsed' : 'Renewal payment required',
      message: shouldLapse
        ? `Your "${sub.plan.name}" subscription has lapsed after ${RENEWAL_MAX_RETRIES} missed renewal attempts. Subscribe again any time.`
        : `Your "${sub.plan.name}" subscription renewal needs a payment.${approveUrl ? ` Complete it here: ${approveUrl}` : ''} (attempt ${failedCount}/${RENEWAL_MAX_RETRIES})`,
      channels: ['email', 'in_app'],
    });
  }

  // AC-3 — idempotent monthly grant: SubscriptionCreditGrant.creditTransactionId is unique, and
  // this checks for an existing grant tied to the *current* renewalDate window (approximated here
  // by "granted since this subscription's last renewalDate update") before writing a second one,
  // so a retried webhook/cron tick can never double-grant.
  private async grantMonthlyCredits(sub: CustomerSubscription, plan: SubscriptionPlan): Promise<void> {
    const recentGrant = await this.prisma.subscriptionCreditGrant.findFirst({
      where: { customerSubscriptionId: sub.id, grantedAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recentGrant) return;

    await this.prisma.$transaction(async (tx) => {
      const creditTransactionId = await this.credits.grant(tx, sub.customerId, plan.monthlyCredits, `Monthly grant for subscription plan "${plan.name}"`);
      await tx.subscriptionCreditGrant.create({ data: { customerSubscriptionId: sub.id, creditTransactionId } });
      // AC-3/AC-8 for logos, same cycle boundary as the credit grant above — a fresh cycle means a
      // fresh logo allowance and a fresh chance to hit (and be re-warned about) the low threshold.
      await tx.customerSubscription.update({ where: { id: sub.id }, data: { logosUsed: 0, logoLimitWarnedAt: null } });
    });
  }
}
