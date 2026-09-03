import { Injectable, Logger } from '@nestjs/common';
import type { CartWithItems } from '../cart/dto/cart.dto';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { BundlesService } from '../bundles/bundles.service';
import { ApiException } from '../common/exceptions/api-exception';
import type { Order, OrderPaymentStatus, OrderStatus, PaymentMethod, Prisma } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { generateBankTransferReference } from './bank-transfer-reference.util';
import { ExchangeRateService } from './exchange-rate.service';
import { PayPalService } from './payments/paypal.service';
import { StripeService } from './payments/stripe.service';
import { assertValidOrderTransition, statusAllowsFileAccess } from './order-state-machine';
import { toOrderDto, toOrderSummaryDto, type OrderDto, type OrderSummaryDto, type OrderWithRelations } from './dto/order.dto';
import type { OrderQueryDto, PaymentConfirmationDto, RefundOrderDto } from './dto/order-write.dto';
import type { PagedResult } from '../designs/designs.service';

const ORDER_INCLUDE = {
  items: { include: { design: { select: { name: true } }, bundle: { select: { name: true } }, size: { select: { sizeLabel: true } } } },
  receipts: { orderBy: { uploadedAt: 'desc' as const } },
} satisfies Prisma.OrderInclude;

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§4 (aspect A-013).
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bundles: BundlesService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-6/AC-7 (Cart spec) — called by CartService.checkout() only, once its own pre-validation
  // (ITEM_NOT_PUBLISHED/SIZE_REQUIRED) has passed. Snapshots every active cart line into an
  // OrderItem, clears those active lines (saved-for-later lines are left untouched), and returns
  // the created order. transactionType is always 'purchase' here — a renewal caller (A-015, not
  // built yet) would set 'renewal' itself once it exists.
  async createFromCart(actor: AccessTokenPayload, cart: CartWithItems, paymentMethod: PaymentMethod): Promise<OrderDto> {
    const active = cart.items.filter((i) => i.status === 'active');

    // Bundle lines need computeBundleTotal() (their price is the sum of member designs' possibly-
    // overridden prices, not a flat column) — resolved per distinct bundle, same as CartService.toDto.
    const bundleTotals = new Map<string, number>();
    for (const item of active) {
      if (item.bundleId && !bundleTotals.has(item.bundleId.toString())) {
        bundleTotals.set(item.bundleId.toString(), await this.bundles.computeBundleTotal(item.bundleId.toString()));
      }
    }
    const unitPriceFor = (item: CartWithItems['items'][number]) =>
      item.design ? Number(item.design.salePricePkr ?? item.design.pricePkr) : bundleTotals.get(item.bundleId!.toString())!;
    const grandTotalPkr = active.reduce((sum, item) => sum + unitPriceFor(item) * item.quantity, 0);

    const bankTransferReference = paymentMethod === 'bank_transfer' ? generateBankTransferReference() : null;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: BigInt(actor.sub),
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr: grandTotalPkr,
          bankTransferReference,
          items: {
            create: active.map((item) => ({
              designId: item.designId,
              bundleId: item.bundleId,
              sizeId: item.sizeId,
              quantity: item.quantity,
              unitPricePkr: unitPriceFor(item),
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      // AC-6 (Cart spec) — clear only the active lines just converted into the order; saved-for-
      // later lines survive checkout untouched.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, status: 'active' } });

      return created;
    });

    this.logger.log(`Order ${order.id} created for customer ${actor.sub} (${paymentMethod}, ${grandTotalPkr} PKR)`);

    let finalOrder: OrderWithRelations = order as OrderWithRelations;
    if (paymentMethod === 'paypal') {
      const created = await this.paypal.createOrder(grandTotalPkr, order.id.toString());
      if (created) {
        finalOrder = (await this.prisma.order.update({
          where: { id: order.id },
          data: { paypalOrderId: created.paypalOrderId },
          include: ORDER_INCLUDE,
        })) as OrderWithRelations;
      }
    } else if (paymentMethod === 'stripe') {
      const created = await this.stripe.createPaymentIntent(grandTotalPkr, order.id.toString());
      if (created) {
        finalOrder = (await this.prisma.order.update({
          where: { id: order.id },
          data: { stripePaymentIntentId: created.paymentIntentId },
          include: ORDER_INCLUDE,
        })) as OrderWithRelations;
      }
    }

    await this.notifications.notify({
      recipientUserId: actor.sub,
      type: 'order_confirmed',
      title: 'Order received',
      message: `Your order #${order.id} for ${grandTotalPkr} PKR has been received and is awaiting payment confirmation.`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });

    return toOrderDto(finalOrder);
  }

  // AC-1 — webhook's real, DB-backed lookup: never trust a bare id echoed back by the provider,
  // always resolve through a reference this service itself wrote at order-creation time.
  async findByPaypalOrderId(paypalOrderId: string): Promise<bigint | null> {
    const order = await this.prisma.order.findFirst({ where: { paypalOrderId } });
    return order?.id ?? null;
  }

  async getForCustomer(orderId: string, customerId: bigint, currencyCode?: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: BigInt(orderId), customerId }, include: ORDER_INCLUDE });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return this.toDtoWithCurrency(order as OrderWithRelations, currencyCode);
  }

  async getForAdmin(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: BigInt(orderId) }, include: ORDER_INCLUDE });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return toOrderDto(order as OrderWithRelations);
  }

  // GET /api/orders/user/history — AC-7.
  async listHistory(customerId: bigint, page: number, pageSize: number, currencyCode?: string): Promise<PagedResult<OrderSummaryDto>> {
    const where = { customerId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
    ]);
    void currencyCode; // OrderSummaryDto is PKR-only by design — full amounts/localAmount live on the detail view.
    return { items: (rows as OrderWithRelations[]).map(toOrderSummaryDto), total };
  }

  // GET /api/orders — admin, filterable (status/customer/date range).
  async listAdmin(query: OrderQueryDto): Promise<PagedResult<OrderSummaryDto>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.customerId ? { customerId: BigInt(query.customerId) } : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}), ...(query.toDate ? { lte: new Date(query.toDate) } : {}) } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items: (rows as OrderWithRelations[]).map(toOrderSummaryDto), total };
  }

  // PUT /api/orders/:id/status — admin manual transitions (bank-transfer path).
  async updateStatus(orderId: string, nextStatus: OrderStatus): Promise<OrderDto> {
    const order = await this.findOrThrow(orderId);
    return this.applyTransition(order, nextStatus);
  }

  // AC-1/AC-10 — called by the PayPal/Stripe webhook handlers once signature verification passes.
  // Idempotent: a duplicate/replayed webhook for an already-confirmed order is a no-op that still
  // returns 200 (never re-releases files a second time, never throws a customer-facing error for
  // what is, from the provider's perspective, a legitimate retry).
  async confirmAutomaticPayment(orderId: bigint, method: PaymentMethod, providerRefs: { paypalOrderId?: string; paypalCaptureId?: string; stripePaymentIntentId?: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.error(`Webhook for unknown order ${orderId}`);
      return;
    }
    if (order.paymentStatus === 'completed') {
      this.logger.log(`Order ${orderId} already payment_confirmed — ignoring duplicate ${method} webhook`);
      return;
    }
    if (order.status !== 'payment_pending' && order.status !== 'pending') {
      this.logger.warn(`Order ${orderId} received a ${method} confirmation webhook while in status "${order.status}" — ignoring`);
      return;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'payment_confirmed',
        paymentStatus: 'completed',
        paypalOrderId: providerRefs.paypalOrderId,
        paypalCaptureId: providerRefs.paypalCaptureId,
        stripePaymentIntentId: providerRefs.stripePaymentIntentId,
      },
      include: ORDER_INCLUDE,
    });

    await this.releaseFilesAndNotify(updated as OrderWithRelations);
  }

  // AC-4/AC-5 — customer uploads a receipt for a bank-transfer order; Admin is notified
  // immediately and the order is flagged pending review.
  async uploadReceipt(orderId: string, customerId: bigint, file: Express.Multer.File): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: BigInt(orderId), customerId } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (order.paymentMethod !== 'bank_transfer') throw new ApiException('VALIDATION_ERROR', 400, 'This order does not use bank transfer');
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');

    const hash = this.storage.hashContent(file.buffer);
    const fileUrl = await this.storage.save(file.buffer, hash);

    await this.prisma.paymentReceipt.create({ data: { orderId: order.id, fileUrl, reviewStatus: 'pending' } });

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'receipt_uploaded',
        title: 'Payment receipt uploaded',
        message: `Order #${order.id} has a new bank-transfer receipt awaiting review.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return this.getForAdmin(orderId);
  }

  // POST /api/orders/:id/payment-confirmation — AC-5. Confirm releases files and moves the order
  // to payment_confirmed; reject returns the order to payment_pending (so the customer can
  // re-upload — spec §8 risk #4 leaves "same order vs. new order" Open; this repo's own
  // "flag, don't guess" convention means picking the least-destructive option — same order, still
  // re-uploadable — rather than silently discarding the order on a rejection).
  async reviewPaymentConfirmation(orderId: string, dto: PaymentConfirmationDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: BigInt(orderId) }, include: { receipts: { orderBy: { uploadedAt: 'desc' }, take: 1 } } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
    const latestReceipt = order.receipts[0];
    if (!latestReceipt) throw new ApiException('RECEIPT_REQUIRED', 422, 'No receipt has been uploaded for this order yet');

    await this.prisma.paymentReceipt.update({
      where: { id: latestReceipt.id },
      data: {
        reviewStatus: dto.approve ? 'confirmed' : 'rejected',
        reviewedByAdminId: BigInt(admin.sub),
        reviewedAt: new Date(),
        rejectionReason: dto.approve ? null : dto.rejectionReason,
      },
    });

    if (dto.approve) {
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'payment_confirmed', paymentStatus: 'completed' },
        include: ORDER_INCLUDE,
      });
      await this.releaseFilesAndNotify(updated as OrderWithRelations);
    } else {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'payment_pending', paymentStatus: 'pending' } });
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'order_status_change',
        title: 'Receipt rejected',
        message: dto.rejectionReason
          ? `Your payment receipt for order #${order.id} was rejected: ${dto.rejectionReason}`
          : `Your payment receipt for order #${order.id} was rejected. Please upload a new receipt.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return this.getForAdmin(orderId);
  }

  // AC-11 — real state-machine support: sets refundedAmountPkr/paymentStatus and moves `status` to
  // `refunded` only for a full refund (a partial refund keeps the order's fulfillment status as-is
  // — spec §8 risk #2 leaves "does it re-lock files" Open, so file access is deliberately left
  // untouched here rather than guessed at; see customer-files.service.ts's own TODO comment on
  // this same open question). Credit-ledger reversal is a real, definitionally-0-today check
  // mirroring CartService.applyCredits()'s TODO(A-015) stub style exactly — never a silent no-op.
  async refund(orderId: string, dto: RefundOrderDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.findOrThrow(orderId);
    if (order.paymentStatus !== 'completed' && order.paymentStatus !== 'partially_refunded') {
      throw new ApiException('VALIDATION_ERROR', 400, 'Only a payment-confirmed order can be refunded');
    }
    const amountPkr = dto.amountPkr ?? Number(order.totalPkr);
    if (amountPkr > Number(order.totalPkr)) throw new ApiException('VALIDATION_ERROR', 400, 'Refund amount exceeds order total');
    const isFullRefund = amountPkr >= Number(order.totalPkr);

    this.reverseCreditsUsedOnOrder(order.id);

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'ORDER_REFUNDED',
      resourceType: 'order',
      resourceId: order.id.toString(),
      changes: { amountPkr, isFullRefund, reason: dto.reason },
    });

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        refundedAmountPkr: amountPkr,
        paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
        status: isFullRefund ? 'refunded' : order.status,
      },
      include: ORDER_INCLUDE,
    });

    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'order_status_change',
      title: isFullRefund ? 'Order refunded' : 'Partial refund issued',
      message: `${amountPkr} PKR has been refunded for order #${order.id}.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });

    return toOrderDto(updated as OrderWithRelations);
  }

  // TODO(A-015): Subscriptions & Credits doesn't exist yet, so there is no credit ledger to
  // reverse — mirrors CartService.applyCredits()'s stub exactly (a real, definitionally-0 check,
  // never a silent no-op, so this becomes a real reversal the moment a Credit model exists).
  private reverseCreditsUsedOnOrder(orderId: bigint): void {
    const creditsUsedOnOrder = 0;
    if (creditsUsedOnOrder > 0) {
      throw new Error(`Unreachable until A-015: order ${orderId} has ${creditsUsedOnOrder} credits to reverse`);
    }
  }

  private async findOrThrow(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: BigInt(orderId) } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return order;
  }

  private async applyTransition(order: Order, nextStatus: OrderStatus): Promise<OrderDto> {
    try {
      assertValidOrderTransition(order.status, nextStatus);
    } catch {
      throw new ApiException('INVALID_ORDER_TRANSITION', 409, `Cannot move order #${order.id} from "${order.status}" to "${nextStatus}"`);
    }

    const paymentStatus: OrderPaymentStatus | undefined = nextStatus === 'payment_confirmed' ? 'completed' : nextStatus === 'cancelled' ? undefined : undefined;
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: nextStatus, ...(paymentStatus ? { paymentStatus } : {}) },
      include: ORDER_INCLUDE,
    });

    if (nextStatus === 'payment_confirmed') {
      await this.releaseFilesAndNotify(updated as OrderWithRelations);
    } else {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'order_status_change',
        title: 'Order status updated',
        message: `Order #${order.id} is now "${nextStatus}".`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return toOrderDto(updated as OrderWithRelations);
  }

  // AC-1/AC-5/AC-6 — the file-release step every state transition into payment_confirmed must go
  // through, real and not stubbed (flagged as a critical bug in the spec's own rollout section if
  // silently broken). Snapshots the resolved file set at THIS moment — a design's files or, for a
  // bundle line, every member design's current files via BundlesService.getAuthorizedFileTargets —
  // into CustomerAuthorizedFile rows, never re-derived later, so a subsequent bundle-membership
  // change never retroactively revokes or grants access (mirrors bundles.service.ts's own AC-4
  // comment on this).
  private async releaseFilesAndNotify(order: OrderWithRelations): Promise<void> {
    const targets: { designFileId: bigint }[] = [];

    const fullOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: { include: { design: { include: { files: true } } } } },
    });

    for (const item of fullOrder.items) {
      if (item.designId && item.design) {
        for (const file of item.design.files) targets.push({ designFileId: file.id });
      } else if (item.bundleId) {
        const bundleTargets = await this.bundles.getAuthorizedFileTargets(item.bundleId.toString());
        for (const t of bundleTargets) targets.push({ designFileId: BigInt(t.fileId) });
      }
    }

    if (targets.length > 0) {
      await this.prisma.customerAuthorizedFile.createMany({
        data: targets.map((t) => ({ orderId: order.id, customerId: order.customerId, designFileId: t.designFileId })),
        skipDuplicates: true,
      });
    } else {
      this.logger.warn(`Order ${order.id} moved to payment_confirmed with zero resolvable files`);
    }

    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'payment_received',
      title: 'Payment confirmed',
      message: `Payment for order #${order.id} has been confirmed. Your files are ready to download.`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });
    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'files_ready',
      title: 'Files ready',
      message: `The files for order #${order.id} are now available in your account.`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });
  }

  private async toDtoWithCurrency(order: OrderWithRelations, currencyCode?: string): Promise<OrderDto> {
    if (!currencyCode || currencyCode.toUpperCase() === 'PKR') return toOrderDto(order);
    const amountLocal = await this.exchangeRates.convert(Number(order.totalPkr), currencyCode);
    return toOrderDto(order, amountLocal !== null ? { currencyCode: currencyCode.toUpperCase(), amountLocal } : undefined);
  }

  // AC-6 — used by CustomerFilesService to decide whether an order's status currently allows
  // authorized-file access, without CustomerFilesService needing its own copy of the state machine.
  static allowsFileAccess(status: OrderStatus): boolean {
    return statusAllowsFileAccess(status);
  }
}
