import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import type { CreditTransactionType, Prisma } from '../generated/prisma';
import { DEFAULT_CHANNELS } from '../notifications/notifications.constants';
import { NotificationService } from '../notifications/services/notification.service';
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
  constructor(
    private readonly prisma: PrismaService,
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

  // A package that has ever been ordered is referenced by order_items (Restrict FK), so it can no longer
  // be deleted — unpublish it instead (the always-safe way to stop new purchases without touching
  // purchase history). A never-ordered package is simply deleted.
  async deletePackage(id: string): Promise<void> {
    const packageId = BigInt(id);
    const orders = await this.prisma.orderItem.count({ where: { creditPackageId: packageId } });
    if (orders > 0) {
      throw new ApiException('CONFLICT', 409, `This credit package is referenced by ${orders} order(s) and cannot be deleted. Unpublish it instead to stop new purchases.`);
    }
    await this.prisma.creditPackage.delete({ where: { id: packageId } });
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

  // AC-6 — a credit-package purchase is a bank-transfer ORDER (OrdersService.createFromCreditPackage,
  // exposed at POST /api/credits/purchase by PurchasesController). Approving its receipt calls
  // grantPurchase() below from inside the approval transaction; nothing a browser sends can add credits.
  //
  // Adds a purchased package's credits, keyed to the order that paid for it. Idempotent: the ledger
  // refuses a second 'purchase' entry for the same order, so a replayed/duplicate approval can never
  // grant twice. Returns whether credits were actually added.
  async grantPurchase(tx: Prisma.TransactionClient, customerId: bigint, orderId: bigint, credits: number, note: string): Promise<boolean> {
    if (credits <= 0) return false;
    const already = await tx.creditTransaction.findFirst({ where: { relatedOrderId: orderId, type: 'purchase' }, select: { id: true } });
    if (already) return false;

    await tx.creditTransaction.create({ data: { customerId, type: 'purchase', amount: credits, relatedOrderId: orderId, note } });
    await this.adjustBalance(tx, customerId, { totalDelta: credits, availableDelta: credits });
    return true;
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

  // AC-11 (Orders spec) — a full refund (or the cancellation of an order that was never paid) restores the
  // credits that order had consumed. Idempotent:
  // an order's credits are restored at most once (a 'refund' ledger row already existing for the order
  // means it was), so a retried refund can never credit the customer twice. Pass the caller's `tx` to
  // make the restore atomic with the refund itself.
  async reverseUsageOnOrder(orderId: bigint, amountPkr: number, tx?: Prisma.TransactionClient, reason: 'refund' | 'cancellation' = 'refund'): Promise<void> {
    if (amountPkr <= 0) return;
    const run = async (client: Prisma.TransactionClient) => {
      const usage = await client.creditTransaction.findFirst({ where: { relatedOrderId: orderId, type: 'usage' } });
      if (!usage) return;
      const restored = await client.creditTransaction.findFirst({ where: { relatedOrderId: orderId, type: 'refund' }, select: { id: true } });
      if (restored) return;

      await client.creditTransaction.create({ data: { customerId: usage.customerId, type: 'refund', amount: amountPkr, relatedOrderId: orderId, note: reason === 'cancellation' ? `Credits returned — order #${orderId} was cancelled before it was paid` : `Refund reversal for order #${orderId}` } });
      await this.adjustBalance(client, usage.customerId, { availableDelta: amountPkr, usedDelta: -amountPkr });
    };
    if (tx) await run(tx);
    else await this.prisma.$transaction(run);
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
      channels: DEFAULT_CHANNELS.credit_purchase,
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
