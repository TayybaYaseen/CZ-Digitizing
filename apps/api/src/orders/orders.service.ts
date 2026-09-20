import { Injectable, Logger } from '@nestjs/common';
import type { CartWithItems } from '../cart/dto/cart.dto';
import { ActivityService } from '../activity/activity.service';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { BundlesService } from '../bundles/bundles.service';
import { ApiException } from '../common/exceptions/api-exception';
import { CreditsService } from '../credits/credits.service';
import type { CreditPackage, Order, OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentTransactionType, Prisma, SubscriptionPlan } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { SubscriptionsService, type SubscriptionActivation } from '../subscriptions/subscriptions.service';
import { generateBankTransferReference } from './bank-transfer-reference.util';
import { ExchangeRateService } from './exchange-rate.service';
import { assertValidOrderTransition, isPaymentGatedStatus, orderAllowsFileAccess } from './order-state-machine';
import { amountDuePkr, confirmedReceiptsTotalPkr, outstandingPkr, roundMoney } from './order-payment.util';
import {
  toAdminOrderSummaryDto,
  toOrderDto,
  toOrderSummaryDto,
  type AdminOrderSummaryDto,
  type OrderDto,
  type OrderSummaryDto,
  type OrderWithCustomer,
  type OrderWithRelations,
} from './dto/order.dto';
import type { OrderQueryDto, PaymentConfirmationDto, RefundOrderDto } from './dto/order-write.dto';
import { formatPkr } from './pkr-format.util';
import { detectReceiptContentType, extensionForReceipt, sanitizeOriginalFilename } from './receipt-file-type.util';
import type { PagedResult } from '../designs/designs.service';

const ORDER_INCLUDE = {
  items: { include: { design: { select: { name: true } }, bundle: { select: { name: true } }, size: { select: { sizeLabel: true } } } },
  receipts: { orderBy: { uploadedAt: 'desc' as const } },
} satisfies Prisma.OrderInclude;

const ADMIN_ORDER_INCLUDE = {
  ...ORDER_INCLUDE,
  customer: { select: { email: true, displayName: true } },
} satisfies Prisma.OrderInclude;

const PAYABLE_PAYMENT_STATUSES: OrderPaymentStatus[] = ['pending', 'failed'];

// What approving a receipt did for an order that IS its own deliverable (no downloadable files): the
// credits it added, or the subscription it activated. Decided inside the approval transaction and
// used afterwards only to word the customer's notification.
type PurchaseFulfilment = { kind: 'credits'; credits: number } | ({ kind: 'subscription' } & SubscriptionActivation);

const PURCHASE_ITEM_FILTER = { OR: [{ creditPackageId: { not: null } }, { subscriptionPlanId: { not: null } }] } satisfies Prisma.OrderItemWhereInput;

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§4/§11 (aspect A-013).
//
// PAYMENT IS BANK TRANSFER ONLY (business decision, spec §11). The customer transfers the exact PKR
// amount due (totalPkr - creditsUsed) to the bank account Admin configured in Settings, uploads the
// receipt, and an Admin approving that receipt is the ONLY thing that confirms payment — there is no
// payment provider, webhook or currency conversion anywhere in this flow.
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bundles: BundlesService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly audit: AuditLogService,
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly activity: ActivityService,
  ) {}

  // AC-6/AC-7 (Cart spec) — called by CartService.checkout() only, once its own pre-validation
  // (ITEM_NOT_PUBLISHED/SIZE_REQUIRED) has passed. Snapshots every active cart line into an
  // OrderItem, clears those active lines (saved-for-later lines are left untouched), and returns
  // the created order. transactionType is always 'purchase' here; subscription renewals create their
  // own 'renewal' order (createFromSubscriptionPlan).
  async createFromCart(actor: AccessTokenPayload, cart: CartWithItems, paymentMethod: PaymentMethod, creditsToApplyPkr = 0): Promise<OrderDto> {
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

    // AC-7 (subscriptions-credits spec) — credits reduce what the customer has to TRANSFER;
    // totalPkr stays the real order total (same "never rewrite the historical amount" posture as
    // OrderItem's unitPricePkr snapshot), creditsUsed records the offset separately. Only what the
    // order actually needs is ever consumed: 5,000 credits against a PKR 1,500 order uses 1,500 and
    // leaves 3,500 in the customer's balance.
    const creditsApplied = Math.min(Math.max(0, creditsToApplyPkr), grandTotalPkr);
    const amountDuePkr = grandTotalPkr - creditsApplied;
    // Fully covered by credits => nothing to transfer, so no bank reference and no receipt.
    const bankTransferReference = amountDuePkr > 0 ? generateBankTransferReference() : null;

    const order = await this.prisma.$transaction(async (tx) => {
      // Duplicate-checkout guard: serialize on the cart row, then confirm the cart still holds
      // exactly the lines this request snapshotted. A second concurrent checkout of the same cart
      // blocks here until the first commits (which deletes the lines), then sees them gone and is
      // refused — instead of both creating an order from the same items.
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${cart.id} FOR UPDATE`;
      const live = await tx.cartItem.findMany({ where: { cartId: cart.id, status: 'active' }, select: { id: true } });
      const liveIds = new Set(live.map((i) => i.id.toString()));
      if (liveIds.size !== active.length || active.some((i) => !liveIds.has(i.id.toString()))) {
        throw new ApiException('CART_CHANGED', 409, 'Your cart changed (or was already checked out) — please review your cart and try again.');
      }

      const created = await tx.order.create({
        data: {
          customerId: BigInt(actor.sub),
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr: grandTotalPkr,
          creditsUsed: creditsApplied,
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

      if (creditsApplied > 0) await this.credits.applyToOrder(tx, BigInt(actor.sub), created.id, creditsApplied);

      // AC-6 (Cart spec) — clear only the active lines just converted into the order; saved-for-
      // later lines survive checkout untouched.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, status: 'active' } });

      return created;
    });

    this.logger.log(`Order ${order.id} created for customer ${actor.sub} (${formatPkr(grandTotalPkr)}, ${formatPkr(creditsApplied)} credits applied, ${formatPkr(amountDuePkr)} due by bank transfer)`);
    await this.recordPurchased(order.id, BigInt(actor.sub));

    if (amountDuePkr === 0) {
      // Fully covered by credits — nothing is owed to the bank, so there is no payment to wait for:
      // confirm through the same single-claim path every other confirmation uses.
      await this.settleCoveredByCredits(order.id);
    } else {
      await this.notifications.notify({
        recipientUserId: actor.sub,
        type: 'order_confirmed',
        title: 'Order received',
        message: `Your order #${order.id} has been received. Transfer exactly ${formatPkr(amountDuePkr)} to our bank account and upload your payment receipt so we can confirm it.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return toOrderDto(await this.reload(order.id));
  }

  // docs/specs/2026-08-28-11-smart-get-a-quote.md AC-7 (aspect A-016). Mirrors createFromCart()'s
  // shape but for a single custom (quote-sourced) line item rather than cart contents. Requires a
  // real customer account (Order.customerId is non-null by schema) — a guest quote's Admin must
  // resolve/create that account before conversion, surfaced as CUSTOMER_ACCOUNT_REQUIRED rather
  // than silently guessing at an implicit account-creation policy (spec §8 risk #2, genuinely Open).
  async createFromQuote(quoteId: string, paymentMethod: PaymentMethod, admin: AccessTokenPayload): Promise<OrderDto> {
    const quote = await this.prisma.quote.findUnique({ where: { id: BigInt(quoteId) }, include: { service: true } });
    if (!quote) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Quote not found');
    if (quote.status !== 'responded') throw new ApiException('QUOTE_NOT_RESPONDED', 409, 'Only a responded quote can be converted to an order');
    if (!quote.customerId) throw new ApiException('CUSTOMER_ACCOUNT_REQUIRED', 400, 'This quote has no linked customer account — resolve or create one before converting');
    if (!quote.quotedPricePkr) throw new ApiException('VALIDATION_ERROR', 400, 'This quote has no quoted price');

    const bankTransferReference = generateBankTransferReference();
    const totalPkr = Number(quote.quotedPricePkr);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: quote.customerId!,
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr,
          bankTransferReference,
          items: {
            create: [
              {
                quoteId: quote.id,
                customDescription: `${quote.service.name} — quote #${quote.id}`,
                quantity: quote.quantity ?? 1,
                unitPricePkr: totalPkr / (quote.quantity ?? 1),
              },
            ],
          },
        },
        include: ORDER_INCLUDE,
      });
      await tx.quote.update({ where: { id: quote.id }, data: { status: 'converted_to_order', orderId: created.id } });
      return created;
    });

    await this.notifications.notify({
      recipientUserId: quote.customerId.toString(),
      type: 'order_confirmed',
      title: 'Order created from your quote',
      message: `Your quote #${quote.id} has been converted into order #${order.id}. Transfer exactly ${formatPkr(totalPkr)} to our bank account and upload your payment receipt.`,
      relatedOrderId: order.id.toString(),
      relatedQuoteId: quote.id.toString(),
      channels: ['email', 'in_app'],
    });

    this.logger.log(`Order ${order.id} created from quote ${quote.id} by admin ${admin.sub}`);
    await this.recordPurchased(order.id, quote.customerId!);
    return toOrderDto(await this.reload(order.id));
  }

  // docs/specs/2026-08-28-12-custom-design-requests.md AC-4 (aspect A-017) — §8 risk #2 resolved:
  // quote acceptance creates a real Order here, mirroring createFromQuote() above, except the
  // trigger is the *customer* accepting their own quote (not an admin converting one), so this
  // takes a customerId to verify ownership instead of an AccessTokenPayload admin.
  async createFromCustomRequest(customRequestId: string, customerId: bigint, paymentMethod: PaymentMethod): Promise<OrderDto> {
    const request = await this.prisma.customRequest.findUnique({ where: { id: BigInt(customRequestId) } });
    if (!request) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    if (request.customerId !== customerId) throw new ApiException('FORBIDDEN', 403, 'You do not have access to this custom request');
    if (request.status !== 'quote_sent') throw new ApiException('CUSTOM_REQUEST_NOT_QUOTED', 409, 'Only a request with a sent quote can be approved');
    if (!request.quotedPricePkr) throw new ApiException('VALIDATION_ERROR', 400, 'This custom request has no quoted price');

    const bankTransferReference = generateBankTransferReference();
    const totalPkr = Number(request.quotedPricePkr);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId,
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr,
          bankTransferReference,
          items: {
            create: [
              {
                customRequestId: request.id,
                customDescription: `Custom design request #${request.requestNumber}`,
                quantity: 1,
                unitPricePkr: totalPkr,
              },
            ],
          },
        },
        include: ORDER_INCLUDE,
      });
      await tx.customRequest.update({ where: { id: request.id }, data: { status: 'approved', orderId: created.id } });
      return created;
    });

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'custom_request_status_update',
        title: 'Custom request quote approved',
        message: `Custom request #${request.requestNumber} was approved and order #${order.id} created (${formatPkr(totalPkr)}), awaiting the customer's bank transfer.`,
        relatedOrderId: order.id.toString(),
        relatedCustomRequestId: request.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    this.logger.log(`Order ${order.id} created from custom request ${request.id} by customer ${customerId}`);
    await this.recordPurchased(order.id, customerId);
    return toOrderDto(await this.reload(order.id));
  }

  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-5/AC-6 — a credit package is bought like
  // any other order: exact PKR price, bank transfer, receipt, Admin approval. Approving the receipt
  // is what adds the credits (fulfilPurchaseInTransaction) — never anything the customer's browser
  // claims. Asking again while one is still awaiting payment returns that order instead of creating
  // a second payment request for the same thing.
  async createFromCreditPackage(customerId: bigint, pkg: CreditPackage): Promise<OrderDto> {
    const totalPkr = Number(pkg.pricePkr);
    if (!(totalPkr > 0)) throw new ApiException('VALIDATION_ERROR', 400, 'This credit package has no price');

    const open = await this.findOpenPurchaseOrder(customerId, 'purchase', { creditPackageId: pkg.id });
    if (open) return toOrderDto(open);

    const creditsGranted = pkg.credits + pkg.bonusCredits;
    const created = await this.prisma.order.create({
      data: {
        customerId,
        status: 'payment_pending',
        paymentStatus: 'pending',
        paymentMethod: 'bank_transfer',
        transactionType: 'purchase',
        totalPkr,
        bankTransferReference: generateBankTransferReference(),
        items: { create: [{ creditPackageId: pkg.id, creditsGranted, customDescription: `Credit package "${pkg.name}" (${creditsGranted} credits)`, quantity: 1, unitPricePkr: totalPkr }] },
      },
      include: ORDER_INCLUDE,
    });

    await this.notifyPurchaseOrderCreated(created.id, customerId, `Your order #${created.id} for the "${pkg.name}" credit package has been received.`, totalPkr);
    return toOrderDto(created as OrderWithRelations);
  }

  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-2/AC-3 + orders spec AC-12 — a subscription's
  // first payment (transactionType 'purchase') and each renewal ('renewal') are ordinary orders that
  // follow the same state machine: exact PKR price, bank transfer, receipt, Admin approval. An unpaid
  // order for the same plan and type is reused rather than duplicated, so the daily renewal job (and a
  // customer double-clicking "Subscribe") never piles up payment requests.
  async createFromSubscriptionPlan(customerId: bigint, plan: SubscriptionPlan, transactionType: PaymentTransactionType): Promise<OrderDto> {
    const totalPkr = Number(plan.pricePkr);
    if (!(totalPkr > 0)) throw new ApiException('VALIDATION_ERROR', 400, 'This subscription plan has no price');

    const open = await this.findOpenPurchaseOrder(customerId, transactionType, { subscriptionPlanId: plan.id });
    if (open) return toOrderDto(open);

    const label = `${transactionType === 'renewal' ? 'Renewal of ' : ''}subscription "${plan.name}" (${plan.billingPeriod})`;
    const created = await this.prisma.order.create({
      data: {
        customerId,
        status: 'payment_pending',
        paymentStatus: 'pending',
        paymentMethod: 'bank_transfer',
        transactionType,
        totalPkr,
        bankTransferReference: generateBankTransferReference(),
        items: { create: [{ subscriptionPlanId: plan.id, customDescription: label.charAt(0).toUpperCase() + label.slice(1), quantity: 1, unitPricePkr: totalPkr }] },
      },
      include: ORDER_INCLUDE,
    });

    const message = transactionType === 'renewal' ? `Your "${plan.name}" subscription is due for renewal (order #${created.id}).` : `Your order #${created.id} for the "${plan.name}" subscription has been received.`;
    await this.notifyPurchaseOrderCreated(created.id, customerId, message, totalPkr);
    return toOrderDto(created as OrderWithRelations);
  }

  private async findOpenPurchaseOrder(customerId: bigint, transactionType: PaymentTransactionType, item: Prisma.OrderItemWhereInput): Promise<OrderWithRelations | null> {
    const open = await this.prisma.order.findFirst({
      where: { customerId, transactionType, status: 'payment_pending', paymentStatus: { in: PAYABLE_PAYMENT_STATUSES }, items: { some: item } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return open as OrderWithRelations | null;
  }

  private async notifyPurchaseOrderCreated(orderId: bigint, customerId: bigint, lead: string, totalPkr: number): Promise<void> {
    await this.recordPurchased(orderId, customerId);
    await this.notifications.notify({
      recipientUserId: customerId.toString(),
      type: 'order_confirmed',
      title: 'Order received',
      message: `${lead} Transfer exactly ${formatPkr(totalPkr)} to our bank account and upload your payment receipt so we can confirm it.`,
      relatedOrderId: orderId.toString(),
      channels: ['email', 'in_app'],
    });
  }

  // AC-11 — fired once per order, right after creation, across all creation paths (cart checkout,
  // admin quote-conversion, customer custom-request quote-approval, credit/subscription purchase).
  // Keyed on order.id alone: an Order row is created exactly once by definition (autoincrement id),
  // so no further idempotency component is needed here.
  private async recordPurchased(orderId: bigint, customerId: bigint): Promise<void> {
    await this.activity.record({
      customerId,
      eventType: 'PURCHASED',
      orderId,
      source: 'web',
      idempotencyKey: `${customerId}:PURCHASED:${orderId}`,
    });
  }

  // The single-winner transition into payment_confirmed for an order that needs no receipt (credits
  // covered it entirely). The WHERE clause is the lock: only a still-payable payment_pending order
  // matches, so of any number of concurrent or replayed calls exactly one gets count === 1 and goes
  // on to release files/notify.
  private async claimPayment(orderId: bigint): Promise<OrderWithRelations | null> {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: 'payment_pending', paymentStatus: { in: PAYABLE_PAYMENT_STATUSES } },
      data: { status: 'payment_confirmed', paymentStatus: 'completed' },
    });
    return result.count === 1 ? this.reload(orderId) : null;
  }

  // Credits count toward the amount paid, but only an order they cover ENTIRELY is settled here:
  // if anything is still owed by bank transfer this does nothing and the files stay locked until that
  // remainder is paid and an admin confirms it.
  private async settleCoveredByCredits(orderId: bigint): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (amountDuePkr(order) > 0) return;
    const claimed = await this.claimPayment(orderId);
    if (claimed) await this.releaseFilesAndNotify(claimed);
  }

  // ---------------------------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------------------------

  async getForCustomer(orderId: string, customerId: bigint, currencyCode?: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: this.toId(orderId), customerId }, include: ORDER_INCLUDE });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return this.toDtoWithCurrency(order as OrderWithRelations, currencyCode);
  }

  async getForAdmin(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: this.toId(orderId) }, include: ORDER_INCLUDE });
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

  // GET /api/orders — admin, filterable (status/customer/date range/payment method) plus the
  // bank-transfer receipt queue (receiptStatus=pending): orders still awaiting payment that have a
  // receipt waiting for review, oldest first.
  async listAdmin(query: OrderQueryDto): Promise<PagedResult<AdminOrderSummaryDto>> {
    const isQueue = query.receiptStatus === 'pending';
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.customerId ? { customerId: BigInt(query.customerId) } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}), ...(query.toDate ? { lte: new Date(query.toDate) } : {}) } }
        : {}),
      ...(isQueue ? { status: 'payment_pending', paymentMethod: 'bank_transfer', receipts: { some: { reviewStatus: 'pending' } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: ADMIN_ORDER_INCLUDE, orderBy: { createdAt: isQueue ? 'asc' : 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items: (rows as OrderWithCustomer[]).map(toAdminOrderSummaryDto), total };
  }

  // PUT /api/orders/:id/status — admin manual transitions. `payment_confirmed` and `refunded` are
  // deliberately NOT reachable here (see isPaymentGatedStatus): a payment is confirmed only by an
  // approved bank-transfer receipt (or credits covering the order), never by a status edit.
  async updateStatus(orderId: string, nextStatus: OrderStatus): Promise<OrderDto> {
    const order = await this.findOrThrow(orderId);
    return this.applyTransition(order, nextStatus);
  }

  // ---------------------------------------------------------------------------------------------
  // Bank transfer receipts (AC-3/AC-4/AC-5)
  // ---------------------------------------------------------------------------------------------

  // AC-4 — customer uploads a receipt for a bank-transfer order; Admin is notified immediately and
  // the order shows up in the receipt queue. Only real images/PDFs are accepted (by magic bytes),
  // only while the order is still awaiting payment, and only one receipt may await review at a time.
  async uploadReceipt(orderId: string, customerId: bigint, file: Express.Multer.File): Promise<OrderDto> {
    const order = await this.findOwned(orderId, customerId);
    this.assertReceiptUploadable(order);

    const contentType = detectReceiptContentType(file.buffer);
    if (!contentType) throw new ApiException('UNSUPPORTED_FILE_TYPE', 415, 'Receipts must be a JPEG, PNG or WebP image, or a PDF');

    const hash = this.storage.hashContent(file.buffer);
    const fileUrl = await this.storage.save(file.buffer, hash);

    await this.prisma.$transaction(async (tx) => {
      // Re-check under a row lock: two simultaneous uploads (or an upload racing a cancellation/
      // approval) must not slip past the pre-check above.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      this.assertReceiptUploadable(fresh);
      const pending = await tx.paymentReceipt.count({ where: { orderId: order.id, reviewStatus: 'pending' } });
      if (pending > 0) throw new ApiException('RECEIPT_ALREADY_PENDING', 409, 'A receipt for this order is already awaiting review');
      await tx.paymentReceipt.create({
        data: { orderId: order.id, fileUrl, reviewStatus: 'pending', contentType, originalFilename: sanitizeOriginalFilename(file.originalname) },
      });
    });

    const outstanding = outstandingPkr(order, await this.prisma.paymentReceipt.findMany({ where: { orderId: order.id }, select: { reviewStatus: true, confirmedAmountPkr: true } }));
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'receipt_uploaded',
        title: 'Payment receipt uploaded',
        message: `Order #${order.id} has a new bank-transfer receipt awaiting review (${formatPkr(outstanding)} outstanding).`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return this.getForAdmin(orderId);
  }

  // Nothing is owed (and no receipt may be uploaded) once an order is paid — including one credits
  // covered entirely — and nothing can be paid on a cancelled/refunded order.
  private assertReceiptUploadable(order: Pick<Order, 'id' | 'status' | 'paymentStatus'>): void {
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
    if (order.status !== 'payment_pending') throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} is "${order.status}" and can no longer be paid`);
  }

  // GET /api/orders/:id/receipts/:receiptId/file — Admin only (role + permission gated on the
  // route). The bytes are served through the API, never a public URL, and only if they still
  // pass the same magic-byte check as at upload (a receipt that somehow doesn't is never served).
  async getReceiptFile(orderId: string, receiptId: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const receipt = await this.prisma.paymentReceipt.findFirst({ where: { id: this.toId(receiptId), orderId: this.toId(orderId) } });
    if (!receipt) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Receipt not found');

    let buffer: Buffer;
    try {
      buffer = await this.storage.read(receipt.fileUrl);
    } catch {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, 'The receipt file is missing from storage');
    }
    const contentType = detectReceiptContentType(buffer);
    if (!contentType) throw new ApiException('UNSUPPORTED_FILE_TYPE', 415, 'This receipt is not a supported image or PDF and will not be served');
    return { buffer, contentType, filename: `receipt-${receipt.id}.${extensionForReceipt(contentType)}` };
  }

  // POST /api/orders/:id/payment-confirmation — AC-5. Approve records the amount Admin confirmed as
  // received; reject leaves the order payment_pending (so the customer can re-upload on the SAME order
  // — spec §8 risk #4) and tells them why.
  //
  // FINAL PAYMENT ACCESS POLICY: an order becomes payment_confirmed — and its files unlock — ONLY when
  // the credits applied plus everything Admin has confirmed across its receipts reach 100% of the
  // order total. An approval for less (a partial transfer) confirms that receipt and records the money,
  // but the order stays payment_pending / paymentStatus pending and its files stay locked; the
  // customer uploads another receipt for the remainder. The amount can only come from Admin — never
  // from the customer — and cannot exceed what is still outstanding.
  //
  // Approval is only possible for an order still awaiting payment whose latest receipt is still
  // pending review — a cancelled/refunded order can never be revived and a receipt already reviewed
  // cannot be re-approved. The order row is locked for the whole transaction, so concurrent or
  // duplicate approvals are serialized: each is judged against the payments confirmed BEFORE it, the
  // receipt claim is single-winner, and (for a purchase order) credits/subscription fulfilment runs
  // only in the one transaction that completes the payment.
  async reviewPaymentConfirmation(orderId: string, dto: PaymentConfirmationDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: this.toId(orderId) }, include: { receipts: { orderBy: { uploadedAt: 'desc' }, take: 1 } } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
    if (order.status !== 'payment_pending') throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} is "${order.status}" — a receipt can no longer confirm its payment`);

    const latestReceipt = order.receipts[0];
    if (!latestReceipt) throw new ApiException('RECEIPT_REQUIRED', 422, 'No receipt has been uploaded for this order yet');
    if (latestReceipt.reviewStatus !== 'pending') throw new ApiException('RECEIPT_REQUIRED', 422, 'The latest receipt has already been reviewed — the customer must upload a new one');

    const rejectionReason = dto.approve ? null : (dto.rejectionReason?.trim().slice(0, 500) || null);

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Serialize every approval/upload/cancel of this order, then judge against fresh state.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { receipts: true } });
      if (fresh.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
      if (fresh.status !== 'payment_pending' || !PAYABLE_PAYMENT_STATUSES.includes(fresh.paymentStatus)) {
        throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} changed state — it can no longer be confirmed by this receipt`);
      }

      const paidBefore = confirmedReceiptsTotalPkr(fresh.receipts);
      const outstandingBefore = roundMoney(amountDuePkr(fresh) - paidBefore);
      const confirmedAmount = dto.approve ? roundMoney(dto.amountPkr ?? outstandingBefore) : null;
      if (confirmedAmount !== null && !(confirmedAmount > 0)) {
        throw new ApiException('VALIDATION_ERROR', 400, 'Nothing is outstanding on this order — there is no amount left to confirm');
      }
      if (confirmedAmount !== null && confirmedAmount > outstandingBefore) {
        throw new ApiException('VALIDATION_ERROR', 400, `The confirmed amount exceeds what is still outstanding on this order (${formatPkr(outstandingBefore)})`);
      }

      const claimedReceipt = await tx.paymentReceipt.updateMany({
        where: { id: latestReceipt.id, reviewStatus: 'pending' },
        data: { reviewStatus: dto.approve ? 'confirmed' : 'rejected', reviewedByAdminId: BigInt(admin.sub), reviewedAt: new Date(), rejectionReason, confirmedAmountPkr: confirmedAmount },
      });
      if (claimedReceipt.count !== 1) throw new ApiException('ORDER_STATE_CHANGED', 409, 'This receipt was just reviewed by someone else');

      if (confirmedAmount === null) return { kind: 'rejected' as const };

      const outstandingAfter = roundMoney(outstandingBefore - confirmedAmount);
      if (outstandingAfter > 0) {
        // PARTIAL payment: the money is recorded, the order stays unpaid, no files, no fulfilment.
        return { kind: 'partial' as const, confirmedAmount, outstandingAfter };
      }

      const moved = await tx.order.updateMany({
        where: { id: order.id, status: 'payment_pending', paymentStatus: { in: PAYABLE_PAYMENT_STATUSES } },
        data: { status: 'payment_confirmed', paymentStatus: 'completed' },
      });
      if (moved.count !== 1) throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} changed state — it can no longer be confirmed by this receipt`);

      return { kind: 'paid' as const, confirmedAmount, fulfilment: await this.fulfilPurchaseInTransaction(tx, order) };
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: dto.approve ? 'ORDER_RECEIPT_APPROVED' : 'ORDER_RECEIPT_REJECTED',
      resourceType: 'order',
      resourceId: order.id.toString(),
      changes: {
        receiptId: latestReceipt.id.toString(),
        ...(rejectionReason ? { reason: rejectionReason } : {}),
        ...(outcome.kind === 'rejected' ? {} : { confirmedAmountPkr: outcome.confirmedAmount, fullyPaid: outcome.kind === 'paid' }),
      },
    });

    if (outcome.kind === 'paid') {
      await this.releaseFilesAndNotify(await this.reload(order.id), outcome.fulfilment);
    } else if (outcome.kind === 'partial') {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'order_status_change',
        title: 'Partial payment received — order not yet paid',
        message:
          `We confirmed ${formatPkr(outcome.confirmedAmount)} of your payment for order #${order.id}, but ${formatPkr(outcome.outstandingAfter)} is still outstanding. ` +
          `Your files stay locked until the full amount has been paid and confirmed. Transfer the remaining ${formatPkr(outcome.outstandingAfter)} and upload the new receipt.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    } else {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'order_status_change',
        title: 'Payment receipt rejected — please upload a new one',
        message: rejectionReason
          ? `Your payment receipt for order #${order.id} was rejected: ${rejectionReason}. Please upload a new receipt.`
          : `Your payment receipt for order #${order.id} was rejected. Please upload a new receipt.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return this.getForAdmin(orderId);
  }

  // A credit-package or subscription order IS its own deliverable: approving its receipt grants the
  // credits / activates the subscription here, inside the same transaction that claimed the receipt
  // and the order. Because that claim is single-winner, this runs exactly once per order — and the
  // credit ledger independently refuses a second 'purchase' entry for the same order. There is
  // nothing left to process or ship afterwards, so the order goes straight to `completed`.
  // Returns null for an ordinary (design/bundle/quote/custom-request) order.
  private async fulfilPurchaseInTransaction(tx: Prisma.TransactionClient, order: Pick<Order, 'id' | 'customerId'>): Promise<PurchaseFulfilment | null> {
    const items = await tx.orderItem.findMany({ where: { orderId: order.id, ...PURCHASE_ITEM_FILTER } });
    if (items.length === 0) return null;

    let fulfilment: PurchaseFulfilment | null = null;
    for (const item of items) {
      if (item.creditPackageId !== null && item.creditsGranted !== null) {
        await this.credits.grantPurchase(tx, order.customerId, order.id, item.creditsGranted, item.customDescription ?? 'Credit package purchase');
        fulfilment = { kind: 'credits', credits: item.creditsGranted };
      } else if (item.subscriptionPlanId !== null) {
        fulfilment = { kind: 'subscription', ...(await this.subscriptions.activateFromOrder(tx, order.customerId, item.subscriptionPlanId)) };
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: 'completed' } });
    return fulfilment;
  }

  // ---------------------------------------------------------------------------------------------
  // Refunds (AC-11) — MANUAL, admin-managed. There is no payment provider, so nothing here moves
  // money: it records that Admin refunded the customer (by returning the money to their bank
  // account outside this system) and keeps the order/credit state consistent with that.
  // ---------------------------------------------------------------------------------------------

  // AC-11 — real state-machine support: accumulates refundedAmountPkr, sets paymentStatus, and moves
  // `status` to `refunded` only once everything the customer actually TRANSFERRED has been refunded.
  // The refundable amount is total − credits used: the credits part is never returned as bank money (it
  // is restored as credits when the refund completes), so an order can never be over-refunded. A partial
  // refund keeps the order's fulfillment status as-is but sets paymentStatus 'partially_refunded', and
  // ANY refund — partial included — RE-LOCKS the customer's files (orderAllowsFileAccess requires
  // paymentStatus 'completed'): after a refund the order is no longer fully paid. Credit-package and
  // subscription orders are refused: this endpoint would not take the credits/subscription back, so it
  // would leave the customer with both the money and the goods.
  async refund(orderId: string, dto: RefundOrderDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.findOrThrow(orderId);
    if (order.paymentStatus !== 'completed' && order.paymentStatus !== 'partially_refunded') {
      throw new ApiException('VALIDATION_ERROR', 400, 'Only a payment-confirmed order can be refunded');
    }
    if ((await this.prisma.orderItem.count({ where: { orderId: order.id, ...PURCHASE_ITEM_FILTER } })) > 0) {
      throw new ApiException(
        'REFUND_NOT_SUPPORTED',
        409,
        'Credit-package and subscription orders cannot be refunded from here: the credits or subscription they granted would not be taken back. Return the money to the customer manually and adjust their credits/subscription separately.',
      );
    }

    const creditsUsed = Number(order.creditsUsed);
    // What the customer actually paid by bank transfer — the ceiling for every bank refund on this order.
    const paidPkr = roundMoney(Number(order.totalPkr) - creditsUsed);
    const alreadyRefundedPkr = Number(order.refundedAmountPkr ?? 0);
    const remainingPkr = roundMoney(paidPkr - alreadyRefundedPkr);
    // An order credits covered entirely has no bank money to return: the (single) refund of it is a
    // zero-amount full refund that only restores the credits.
    const amountPkr = dto.amountPkr ?? remainingPkr;
    if (paidPkr > 0 && amountPkr <= 0) throw new ApiException('VALIDATION_ERROR', 400, 'Nothing is left to refund on this order');
    if (amountPkr > remainingPkr) {
      throw new ApiException(
        'VALIDATION_ERROR',
        400,
        paidPkr > 0
          ? `Refund amount exceeds what is left to refund on this order (${formatPkr(remainingPkr)} of the ${formatPkr(paidPkr)} paid by bank transfer)`
          : 'This order was paid entirely with credits — there is no bank transfer to refund; refund it without an amount to restore the credits',
      );
    }
    const refundedTotalPkr = roundMoney(alreadyRefundedPkr + amountPkr);
    const isFullRefund = refundedTotalPkr >= paidPkr;

    // Optimistic claim: the WHERE pins the payment status AND refunded total this request validated
    // against, so two concurrent refunds can never both apply (nor over-refund the order), and the
    // credits reversal below runs at most once.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: order.paymentStatus, refundedAmountPkr: order.refundedAmountPkr },
        data: {
          refundedAmountPkr: refundedTotalPkr,
          paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
          ...(isFullRefund ? { status: 'refunded' as const } : {}),
        },
      });
      if (claimed.count !== 1) throw new ApiException('ORDER_STATE_CHANGED', 409, `Order #${order.id} changed while the refund was being recorded — reload and try again`);
      if (isFullRefund && creditsUsed > 0) await this.credits.reverseUsageOnOrder(order.id, creditsUsed, tx);
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'ORDER_REFUNDED',
      resourceType: 'order',
      resourceId: order.id.toString(),
      changes: { amountPkr, refundedTotalPkr, paidPkr, isFullRefund, creditsRestored: isFullRefund ? creditsUsed : 0, manual: true, reason: dto.reason },
    });

    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'order_status_change',
      title: isFullRefund ? 'Order refunded' : 'Partial refund issued',
      message:
        (amountPkr > 0
          ? `A refund of ${formatPkr(amountPkr)} has been recorded for order #${order.id}.${dto.reason ? ` Reason: ${dto.reason}.` : ''} ` +
            `Refunds are returned manually to your bank account by our team — we will contact you if we need your account details.`
          : `Order #${order.id} has been refunded.${dto.reason ? ` Reason: ${dto.reason}.` : ''} It was paid entirely with credits, so no bank refund is due.`) +
        (isFullRefund && creditsUsed > 0 ? ` The ${formatPkr(creditsUsed)} of credits you used on this order were restored to your balance.` : '') +
        // Any refund, partial included, means the order is no longer fully paid: its files are locked again.
        ' The downloadable files for this order are now locked.',
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });

    return toOrderDto(await this.reload(order.id));
  }

  // ---------------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------------

  private toId(value: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    }
  }

  private async findOrThrow(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: this.toId(orderId) } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return order;
  }

  private async findOwned(orderId: string, customerId: bigint): Promise<Order> {
    const order = await this.prisma.order.findFirst({ where: { id: this.toId(orderId), customerId } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return order;
  }

  private async reload(orderId: bigint): Promise<OrderWithRelations> {
    return (await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE })) as OrderWithRelations;
  }

  private async applyTransition(order: Order, nextStatus: OrderStatus): Promise<OrderDto> {
    if (isPaymentGatedStatus(nextStatus)) throw await this.gatedTransitionError(order, nextStatus);

    try {
      assertValidOrderTransition(order.status, nextStatus);
    } catch {
      throw new ApiException('INVALID_ORDER_TRANSITION', 409, `Cannot move order #${order.id} from "${order.status}" to "${nextStatus}"`);
    }

    // Cancelling an order that was never paid must not keep the customer's credits: nothing was
    // received for them. (A paid order's credits come back through the refund action instead.) The
    // restore is idempotent and runs in the same transaction as the status change.
    const creditsUsed = Number(order.creditsUsed);
    const returnCredits = nextStatus === 'cancelled' && order.paymentStatus !== 'completed' && creditsUsed > 0;

    // The WHERE pins the status we validated against, so two admins (or an admin racing a receipt
    // approval) can't both apply a transition computed from the same stale read.
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: nextStatus } });
      if (moved.count !== 1) throw new ApiException('ORDER_STATE_CHANGED', 409, `Order #${order.id} changed while it was being updated — reload and try again`);
      if (returnCredits) await this.credits.reverseUsageOnOrder(order.id, creditsUsed, tx, 'cancellation');
    });
    const updated = await this.reload(order.id);

    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'order_status_change',
      title: 'Order status updated',
      message: `Order #${order.id} is now "${nextStatus}".${returnCredits ? ` The ${formatPkr(creditsUsed)} of credits you used on it were returned to your balance.` : ''}`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });

    return toOrderDto(updated);
  }

  private async gatedTransitionError(order: Order, nextStatus: OrderStatus): Promise<ApiException> {
    if (nextStatus === 'refunded') {
      return new ApiException('USE_REFUND_ENDPOINT', 409, 'An order can only be refunded through the refund action, which also updates its payment status.');
    }
    // payment_confirmed
    if (order.paymentStatus === 'completed') return new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
    const receipts = await this.prisma.paymentReceipt.count({ where: { orderId: order.id } });
    if (receipts === 0) return new ApiException('RECEIPT_REQUIRED', 422, 'An order can only be confirmed by reviewing an uploaded bank-transfer receipt — none has been uploaded');
    return new ApiException('PAYMENT_CONFIRMATION_REQUIRED', 409, 'Payment can only be confirmed by approving the uploaded receipt (Confirm Payment), not by changing the status');
  }

  // AC-1/AC-5/AC-6 — the file-release step every state transition into payment_confirmed must go
  // through, real and not stubbed (flagged as a critical bug in the spec's own rollout section if
  // silently broken). Snapshots the resolved file set at THIS moment — a design's files or, for a
  // bundle line, every member design's current files via BundlesService.getAuthorizedFileTargets —
  // into CustomerAuthorizedFile rows, never re-derived later, so a subsequent bundle-membership
  // change never retroactively revokes or grants access (mirrors bundles.service.ts's own AC-4
  // comment on this). Every caller reaches this only after winning the single-claim transition
  // into payment_confirmed, so it runs exactly once per order.
  private async releaseFilesAndNotify(order: OrderWithRelations, fulfilment: PurchaseFulfilment | null = null): Promise<void> {
    // AC-11 — fired once, here, regardless of which call site drove the payment_confirmed
    // transition — this is the single choke point they all funnel through.
    await this.activity.record({
      customerId: order.customerId,
      eventType: 'PAID',
      orderId: order.id,
      source: 'web',
      idempotencyKey: `${order.customerId}:PAID:${order.id}`,
    });

    // A credit-package / subscription order has no files: the approval already delivered it.
    if (fulfilment) {
      await this.notifyPurchaseFulfilled(order, fulfilment);
      return;
    }

    // docs/specs/2026-08-28-12-custom-design-requests.md AC-4/§8 risk #2 — a custom-request order
    // has no catalog design/bundle files to release yet (the deliverable is produced afterward, at
    // the ready -> delivered step via CustomRequestFile), so payment confirmation here instead
    // advances the linked request straight to in_production and marks its own paymentStatus
    // completed, then returns early — the file-release/"zero resolvable files" logic below is only
    // meaningful for catalog-design orders.
    const linkedCustomRequest = await this.prisma.customRequest.findUnique({ where: { orderId: order.id } });
    if (linkedCustomRequest) {
      await this.prisma.customRequest.update({ where: { id: linkedCustomRequest.id }, data: { status: 'in_production', paymentStatus: 'completed' } });
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'custom_request_status_update',
        title: 'Payment confirmed — production started',
        message: `Payment for custom request #${linkedCustomRequest.requestNumber} has been confirmed. Your request is now in production.`,
        relatedOrderId: order.id.toString(),
        relatedCustomRequestId: linkedCustomRequest.id.toString(),
        channels: ['email', 'in_app'],
      });
      return;
    }

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

  private async notifyPurchaseFulfilled(order: OrderWithRelations, fulfilment: PurchaseFulfilment): Promise<void> {
    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'payment_received',
      title: 'Payment confirmed',
      message: `Your bank transfer for order #${order.id} (${formatPkr(Number(order.totalPkr))}) has been confirmed.`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });
    if (fulfilment.kind === 'credits') {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'credit_purchase',
        title: 'Credits purchased',
        message: `${fulfilment.credits} credits have been added to your account.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    } else {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'subscription_renewal',
        title: fulfilment.isRenewal ? 'Subscription renewed' : 'Subscription activated',
        message: `Your "${fulfilment.planName}" subscription is now active. Next renewal: ${fulfilment.renewalDate.toDateString()}.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }
  }

  private async toDtoWithCurrency(order: OrderWithRelations, currencyCode?: string): Promise<OrderDto> {
    if (!currencyCode || currencyCode.toUpperCase() === 'PKR') return toOrderDto(order);
    const amountLocal = await this.exchangeRates.convert(Number(order.totalPkr), currencyCode);
    return toOrderDto(order, amountLocal !== null ? { currencyCode: currencyCode.toUpperCase(), amountLocal } : undefined);
  }

  // AC-6 + the final payment access policy — whether this order currently lets its customer reach
  // their files (fully paid and confirmed, no refund, not cancelled).
  static allowsFileAccess(order: Pick<Order, 'status' | 'paymentStatus' | 'refundedAmountPkr'>): boolean {
    return orderAllowsFileAccess(order);
  }
}
