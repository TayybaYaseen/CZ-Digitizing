import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import type { CreditTransactionType, Prisma } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PagedResult } from '../designs/designs.service';
import { CreditPackageWriteDto, GiftCreditsDto } from './dto/credit-write.dto';
import { CreditBalanceDto, CreditPackageDto, CreditTransactionDto, toCreditPackageDto, toCreditTransactionDto } from './dto/credit.dto';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3/§4 (aspect A-015b). CustomerCredits is a
// cached balance derived from CreditTransaction — every mutation here writes both inside the same
// transaction so the cache can never drift from the ledger it mirrors (spec §9 observability note:
// a negative availableCredits balance is a ledger-integrity violation that must never occur).
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationService,
  ) {}

  async listPublicPackages(): Promise<CreditPackageDto[]> {
    const rows = await this.prisma.creditPackage.findMany({ where: { isPublished: true }, orderBy: { pricePkr: 'asc' } });
    return rows.map(toCreditPackageDto);
  }

  async listAdminPackages(): Promise<CreditPackageDto[]> {
    const rows = await this.prisma.creditPackage.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toCreditPackageDto);
  }

  async createPackage(dto: CreditPackageWriteDto): Promise<CreditPackageDto> {
    const created = await this.prisma.creditPackage.create({
      data: { name: dto.name, credits: dto.credits, bonusCredits: dto.bonusCredits, pricePkr: dto.pricePkr, isPublished: dto.isPublished },
    });
    return toCreditPackageDto(created);
  }

  async updatePackage(id: string, dto: CreditPackageWriteDto): Promise<CreditPackageDto> {
    const updated = await this.prisma.creditPackage.update({
      where: { id: BigInt(id) },
      data: { name: dto.name, credits: dto.credits, bonusCredits: dto.bonusCredits, pricePkr: dto.pricePkr, isPublished: dto.isPublished },
    });
    return toCreditPackageDto(updated);
  }

  // Unlike SubscriptionPlan, CreditPackage has no FK referencing it from anywhere (a purchase's
  // CreditTransaction records the resulting credit amount directly, never the package id it came
  // from) — so a hard delete here is always safe and never needs a "has subscribers" guard.
  async deletePackage(id: string): Promise<void> {
    await this.prisma.creditPackage.delete({ where: { id: BigInt(id) } });
  }

  async getBalance(customerId: bigint): Promise<CreditBalanceDto> {
    const row = await this.prisma.customerCredits.findUnique({ where: { customerId } });
    return { available: row?.availableCredits ?? 0, used: row?.usedCredits ?? 0, total: row?.totalCredits ?? 0 };
  }

  async listTransactions(customerId: bigint, page: number, pageSize: number): Promise<PagedResult<CreditTransactionDto>> {
    const where = { customerId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.creditTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.creditTransaction.count({ where }),
    ]);
    return { items: rows.map(toCreditTransactionDto), total };
  }

  // AC-6 (part 1) — mirrors OrdersService.createFromCart()'s "create a payment intent, track the
  // provider reference, confirm later via webhook" shape, but for a credit package rather than an
  // Order row (no Order concept applies to a credit top-up). PendingCreditPurchase is what lets
  // handleWebhookConfirmed() below recover (customerId, packageId) once the provider's webhook
  // fires — see that model's own doc comment in schema.prisma for why this can't just be a
  // CreditTransaction row created eagerly (the ledger only ever records confirmed money).
  async purchase(customerId: bigint, packageId: string, paymentMethod: 'paypal' | 'stripe'): Promise<{ approveUrl: string | null; clientSecret: string | null }> {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: BigInt(packageId) } });
    if (!pkg || !pkg.isPublished) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Credit package not found');

    const pending = await this.prisma.pendingCreditPurchase.create({ data: { customerId, packageId: pkg.id } });

    if (paymentMethod === 'paypal') {
      const created = await this.paypal.createOrder(Number(pkg.pricePkr), `credit:${pending.id}`);
      if (!created) throw new ApiException('VALIDATION_ERROR', 502, 'Payment provider is not available');
      await this.prisma.pendingCreditPurchase.update({ where: { id: pending.id }, data: { paypalOrderId: created.paypalOrderId } });
      return { approveUrl: created.approveUrl, clientSecret: null };
    }

    const created = await this.stripe.createPaymentIntent(Number(pkg.pricePkr), `credit:${pending.id}`);
    if (!created) throw new ApiException('VALIDATION_ERROR', 502, 'Payment provider is not available');
    await this.prisma.pendingCreditPurchase.update({ where: { id: pending.id }, data: { stripePaymentIntentId: created.paymentIntentId } });
    return { approveUrl: null, clientSecret: created.clientSecret };
  }

  // AC-6 (part 2) — called by CreditsWebhooksController once PayPal/Stripe signature verification
  // passes. Idempotent: a pending row is deleted the first time it's processed, so a replayed
  // webhook for the same pendingId finds nothing and safely no-ops (same posture as
  // OrdersService.confirmAutomaticPayment's duplicate-webhook guard).
  async confirmPurchase(pendingId: bigint): Promise<void> {
    const pending = await this.prisma.pendingCreditPurchase.findUnique({ where: { id: pendingId } });
    if (!pending) {
      this.logger.log(`Credit purchase ${pendingId} already processed or unknown — ignoring duplicate webhook`);
      return;
    }
    const pkg = await this.prisma.creditPackage.findUniqueOrThrow({ where: { id: pending.packageId } });
    const totalCredits = pkg.credits + pkg.bonusCredits;

    await this.prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({ data: { customerId: pending.customerId, type: 'purchase', amount: totalCredits, note: `Purchased package "${pkg.name}"` } });
      await this.adjustBalance(tx, pending.customerId, { totalDelta: totalCredits, availableDelta: totalCredits });
      await tx.pendingCreditPurchase.delete({ where: { id: pending.id } });
    });

    await this.notifications.notify({
      recipientUserId: pending.customerId.toString(),
      type: 'credit_purchase',
      title: 'Credits purchased',
      message: `${totalCredits} credits have been added to your account.`,
      channels: ['email', 'in_app'],
    });
  }

  // AC-7 — real balance check backing CartService.applyCredits()'s pre-validation and
  // OrdersService.createFromCart()'s actual deduction. Throws the same INSUFFICIENT_CREDITS the
  // cart stub already throws, so callers don't need to change their error handling.
  async assertSufficientBalance(customerId: bigint, amountPkr: number): Promise<void> {
    if (amountPkr <= 0) return;
    const balance = await this.getBalance(customerId);
    if (amountPkr > balance.available) throw new ApiException('INSUFFICIENT_CREDITS', 422, `Only ${balance.available} credits are available`);
  }

  // AC-7 — called by OrdersService.createFromCart() inside its own order-creation transaction via
  // the passed-in `tx` client, so a failed order creation can never leave a dangling credit debit.
  async applyToOrder(tx: Prisma.TransactionClient, customerId: bigint, orderId: bigint, amountPkr: number): Promise<void> {
    if (amountPkr <= 0) return;
    const balance = await tx.customerCredits.findUnique({ where: { customerId } });
    if (!balance || amountPkr > balance.availableCredits) throw new ApiException('INSUFFICIENT_CREDITS', 422, `Only ${balance?.availableCredits ?? 0} credits are available`);

    await tx.creditTransaction.create({ data: { customerId, type: 'usage', amount: -amountPkr, relatedOrderId: orderId, note: `Applied to order #${orderId}` } });
    await this.adjustBalance(tx, customerId, { availableDelta: -amountPkr, usedDelta: amountPkr });
  }

  // AC-11 (Orders spec) / mirrors OrdersService.reverseCreditsUsedOnOrder()'s former TODO(A-015)
  // stub — a full/partial refund restores the credits that order had consumed.
  async reverseUsageOnOrder(orderId: bigint, amountPkr: number): Promise<void> {
    if (amountPkr <= 0) return;
    const usage = await this.prisma.creditTransaction.findFirst({ where: { relatedOrderId: orderId, type: 'usage' } });
    if (!usage) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({ data: { customerId: usage.customerId, type: 'refund', amount: amountPkr, relatedOrderId: orderId, note: `Refund reversal for order #${orderId}` } });
      await this.adjustBalance(tx, usage.customerId, { availableDelta: amountPkr, usedDelta: -amountPkr });
    });
  }

  // AC-3/AC-8 — the subscription renewal cron's monthly grant, invoked by SubscriptionsService
  // inside SubscriptionCreditGrant's own idempotency-guarded transaction.
  async grant(tx: Prisma.TransactionClient, customerId: bigint, amount: number, note: string): Promise<bigint> {
    const txRow = await tx.creditTransaction.create({ data: { customerId, type: 'grant', amount, note } });
    await this.adjustBalance(tx, customerId, { totalDelta: amount, availableDelta: amount });
    return txRow.id;
  }

  // AC-10 — gift credits between two customers. Both ledger rows point at each other via
  // giftCounterpartyId so either side of the gift is traceable from one row (spec's own wording:
  // "a credit_transactions row of type adjustment recorded for each side").
  async gift(senderId: bigint, dto: GiftCreditsDto): Promise<CreditBalanceDto> {
    const recipient = await this.prisma.user.findUnique({ where: { email: dto.recipientEmail } });
    if (!recipient) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Recipient not found');
    if (recipient.id === senderId) throw new ApiException('VALIDATION_ERROR', 400, 'Cannot gift credits to yourself');

    await this.assertSufficientBalance(senderId, dto.amount);

    await this.prisma.$transaction(async (tx) => {
      const balance = await tx.customerCredits.findUnique({ where: { customerId: senderId } });
      if (!balance || dto.amount > balance.availableCredits) throw new ApiException('INSUFFICIENT_CREDITS', 422, `Only ${balance?.availableCredits ?? 0} credits are available`);

      await tx.creditTransaction.create({ data: { customerId: senderId, type: 'adjustment', amount: -dto.amount, giftCounterpartyId: recipient.id, note: `Gift sent to ${recipient.email}` } });
      await this.adjustBalance(tx, senderId, { availableDelta: -dto.amount, usedDelta: dto.amount });

      await tx.creditTransaction.create({ data: { customerId: recipient.id, type: 'adjustment', amount: dto.amount, giftCounterpartyId: senderId, note: `Gift received from ${dto.recipientEmail}` } });
      await this.adjustBalance(tx, recipient.id, { totalDelta: dto.amount, availableDelta: dto.amount });
    });

    await this.notifications.notify({
      recipientUserId: recipient.id.toString(),
      type: 'credit_purchase',
      title: 'You received a gift',
      message: `You received ${dto.amount} credits as a gift.`,
      channels: ['email', 'in_app'],
    });

    return this.getBalance(senderId);
  }

  private async adjustBalance(
    tx: Prisma.TransactionClient,
    customerId: bigint,
    delta: { totalDelta?: number; availableDelta?: number; usedDelta?: number },
  ): Promise<void> {
    await tx.customerCredits.upsert({
      where: { customerId },
      create: {
        customerId,
        totalCredits: Math.max(0, delta.totalDelta ?? 0),
        availableCredits: Math.max(0, delta.availableDelta ?? 0),
        usedCredits: Math.max(0, delta.usedDelta ?? 0),
      },
      update: {
        totalCredits: { increment: delta.totalDelta ?? 0 },
        availableCredits: { increment: delta.availableDelta ?? 0 },
        usedCredits: { increment: delta.usedDelta ?? 0 },
      },
    });
  }
}

export type { CreditTransactionType };
