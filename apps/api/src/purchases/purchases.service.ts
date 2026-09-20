import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/exceptions/api-exception';
import type { Env } from '../config/env.validation';
import type { CustomerSubscription, SubscriptionPlan } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import type { OrderDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { formatPkr } from '../orders/pkr-format.util';
import { PrismaService } from '../prisma/prisma.service';
import { RENEWAL_MAX_RETRIES } from '../subscriptions/subscriptions.service';

// Credit-package purchases, subscription sign-ups and renewals (docs/specs/2026-08-28-09-subscriptions-
// credits.md AC-2/AC-3/AC-5/AC-6, orders spec AC-12). Bank transfer is the ONLY payment method, so all
// three create an ordinary bank-transfer ORDER: the customer sees the exact PKR amount and the bank
// details Admin configured, transfers, uploads a receipt, and Admin approving it is what grants the
// credits / activates the subscription (OrdersService.reviewPaymentConfirmation). This service never
// grants anything itself.
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async purchaseCredits(customerId: bigint, packageId: string): Promise<OrderDto> {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: this.toId(packageId, 'Credit package not found') } });
    if (!pkg || !pkg.isPublished) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Credit package not found');
    return this.orders.createFromCreditPackage(customerId, pkg);
  }

  // ALREADY_SUBSCRIBED (spec §3) is checked here, not just at approval time, so the customer gets an
  // immediate, honest rejection instead of paying for a subscription that is already active.
  async subscribe(customerId: bigint, planId: string): Promise<OrderDto> {
    const existing = await this.prisma.customerSubscription.findUnique({ where: { customerId } });
    if (existing && existing.status === 'active') throw new ApiException('ALREADY_SUBSCRIBED', 409, 'An active subscription already exists');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: this.toId(planId, 'Subscription plan not found') } });
    if (!plan || !plan.isPublished) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Subscription plan not found');
    return this.orders.createFromSubscriptionPlan(customerId, plan, 'purchase');
  }

  // AC-3/AC-8 — invoked by SubscriptionRenewalService's daily cron for every active, auto-renewing
  // subscription whose renewalDate has arrived. There is no stored payment method to charge: a renewal
  // is a bank-transfer order (transactionType 'renewal') the customer is asked to pay. The same unpaid
  // renewal order is reused each day, so reminders never pile up duplicate payment requests. A
  // subscription that misses RENEWAL_MAX_RETRIES reminders across RENEWAL_GRACE_PERIOD_DAYS lapses
  // (AC-8: no further automatic credit grant after that) — but a renewal whose receipt is already
  // waiting for Admin review is NOT a missed attempt: the customer has done their part.
  async attemptRenewal(sub: CustomerSubscription & { plan: SubscriptionPlan }): Promise<void> {
    const order = await this.orders.createFromSubscriptionPlan(sub.customerId, sub.plan, 'renewal');
    if (order.receipts.some((r) => r.reviewStatus === 'pending')) {
      this.logger.log(`Renewal order ${order.id} for subscription ${sub.id} has a receipt awaiting review — not counting a missed attempt`);
      return;
    }

    const failedCount = sub.failedRenewalCount + 1;
    const shouldLapse = failedCount >= RENEWAL_MAX_RETRIES;

    await this.prisma.customerSubscription.update({
      where: { customerId: sub.customerId },
      data: shouldLapse
        ? { status: 'lapsed', autoRenew: false, failedRenewalCount: failedCount, lastRenewalFailedAt: new Date() }
        : { failedRenewalCount: failedCount, lastRenewalFailedAt: new Date() },
    });

    const payUrl = `${this.config.get('WEB_BASE_URL', { infer: true }).replace(/\/+$/, '')}/checkout/bank-transfer/${order.id}`;
    await this.notifications.notify({
      recipientUserId: sub.customerId.toString(),
      type: 'subscription_renewal_failed',
      title: shouldLapse ? 'Subscription lapsed' : 'Renewal payment required',
      message: shouldLapse
        ? `Your "${sub.plan.name}" subscription has lapsed after ${RENEWAL_MAX_RETRIES} missed renewal reminders. You can still pay renewal order #${order.id} or subscribe again any time.`
        : `Your "${sub.plan.name}" subscription renewal is due: transfer exactly ${formatPkr(order.amountDuePkr)} to our bank account and upload your receipt at ${payUrl} (reminder ${failedCount}/${RENEWAL_MAX_RETRIES}).`,
      relatedOrderId: order.id,
      channels: ['email', 'in_app'],
    });
  }

  private toId(value: string, notFound: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, notFound);
    }
  }
}
