import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CartWithItems } from '../cart/dto/cart.dto';
import { ActivityService } from '../activity/activity.service';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { BundlesService } from '../bundles/bundles.service';
import type { Env } from '../config/env.validation';
import { ApiException } from '../common/exceptions/api-exception';
import { CreditsService } from '../credits/credits.service';
import type { Order, OrderPaymentStatus, OrderStatus, PaymentMethod, Prisma } from '../generated/prisma';
import { NotificationService } from '../notifications/services/notification.service';
import { PaymentAmountService, type PaymentQuote } from '../payments/payment-amount.service';
import { decimalToMinor, minorToDecimal } from '../payments/provider-amount.util';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { generateBankTransferReference } from './bank-transfer-reference.util';
import { ExchangeRateService } from './exchange-rate.service';
import { PayPalService } from './payments/paypal.service';
import { StripeService } from './payments/stripe.service';
import { assertValidOrderTransition, isPaymentGatedStatus, statusAllowsFileAccess } from './order-state-machine';
import {
  toAdminOrderSummaryDto,
  toOrderDto,
  toOrderSummaryDto,
  type AdminOrderSummaryDto,
  type OrderDto,
  type OrderSummaryDto,
  type OrderWithCustomer,
  type OrderWithRelations,
  type PaymentSessionDto,
} from './dto/order.dto';
import type { OrderQueryDto, PaymentConfirmationDto, RefundOrderDto } from './dto/order-write.dto';
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

// What a payment provider (or the server's own read of the provider) reports about a completed
// payment. Confirmation compares this against the amount/currency LOCKED on the order — a valid
// signature alone never confirms anything.
export interface ProviderPaymentEvidence {
  method: 'paypal' | 'stripe';
  currency: string;
  amountMinor: number;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  stripePaymentIntentId?: string;
}

// confirmed          — this call moved the order to payment_confirmed (files released, customer notified).
// already_confirmed  — a duplicate/replay/lost race: nothing done, nothing re-sent.
// ignored            — the order isn't in a payable state (unknown, cancelled, wrong method...): nothing done.
// rejected           — the provider's amount/currency/reference did not match the order: nothing done.
export type ProviderConfirmationOutcome = 'confirmed' | 'already_confirmed' | 'ignored' | 'rejected';

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
    private readonly paymentAmounts: PaymentAmountService,
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly audit: AuditLogService,
    private readonly credits: CreditsService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // AC-6/AC-7 (Cart spec) — called by CartService.checkout() only, once its own pre-validation
  // (ITEM_NOT_PUBLISHED/SIZE_REQUIRED) has passed. Snapshots every active cart line into an
  // OrderItem, clears those active lines (saved-for-later lines are left untouched), and returns
  // the created order. transactionType is always 'purchase' here — a renewal caller (A-015, not
  // built yet) would set 'renewal' itself once it exists.
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

    // AC-7 (subscriptions-credits spec) — credits reduce what's actually charged to the payment
    // provider; totalPkr stays the real order total (same "never rewrite the historical amount"
    // posture as OrderItem's unitPricePkr snapshot), creditsUsed records the offset separately.
    // Only what the order actually needs is ever consumed: 5,000 credits against a Rs 1,500 order
    // uses 1,500 and leaves 3,500 in the customer's balance.
    const creditsApplied = Math.min(Math.max(0, creditsToApplyPkr), grandTotalPkr);
    const amountDuePkr = grandTotalPkr - creditsApplied;

    // Priced and validated BEFORE anything is written: no exchange rate / unconfigured provider
    // means the customer gets a clear error instead of an unpayable order.
    const paymentQuote = await this.preparePayment(paymentMethod, amountDuePkr);
    const bankTransferReference = paymentMethod === 'bank_transfer' && amountDuePkr > 0 ? generateBankTransferReference() : null;

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
          ...this.providerColumns(paymentQuote),
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

    this.logger.log(`Order ${order.id} created for customer ${actor.sub} (${paymentMethod}, ${grandTotalPkr} PKR, ${creditsApplied} credits applied, ${amountDuePkr} PKR due)`);
    await this.recordPurchased(order.id, BigInt(actor.sub));

    let session: PaymentSessionDto | null = null;
    if (amountDuePkr === 0) {
      // Fully covered by credits — nothing is owed to any provider or bank, so there is no payment
      // to wait for: confirm through the same single-claim path every other payment uses.
      await this.settleCoveredByCredits(order.id);
    } else {
      session = await this.startProviderSession(order);
      await this.notifications.notify({
        recipientUserId: actor.sub,
        type: 'order_confirmed',
        title: 'Order received',
        message: `Your order #${order.id} for ${grandTotalPkr} PKR has been received and is awaiting payment confirmation.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return toOrderDto(await this.reload(order.id), undefined, session);
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

    const bankTransferReference = paymentMethod === 'bank_transfer' ? generateBankTransferReference() : null;
    const totalPkr = Number(quote.quotedPricePkr);
    const paymentQuote = await this.preparePayment(paymentMethod, totalPkr);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: quote.customerId!,
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr,
          bankTransferReference,
          ...this.providerColumns(paymentQuote),
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

    const session = await this.startProviderSession(order);

    await this.notifications.notify({
      recipientUserId: quote.customerId.toString(),
      type: 'order_confirmed',
      title: 'Order created from your quote',
      message: `Your quote #${quote.id} has been converted into order #${order.id} (${totalPkr} PKR), awaiting payment confirmation.`,
      relatedOrderId: order.id.toString(),
      relatedQuoteId: quote.id.toString(),
      channels: ['email', 'in_app'],
    });

    this.logger.log(`Order ${order.id} created from quote ${quote.id} by admin ${admin.sub}`);
    await this.recordPurchased(order.id, quote.customerId!);
    return toOrderDto(await this.reload(order.id), undefined, session);
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

    const bankTransferReference = paymentMethod === 'bank_transfer' ? generateBankTransferReference() : null;
    const totalPkr = Number(request.quotedPricePkr);
    const paymentQuote = await this.preparePayment(paymentMethod, totalPkr);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId,
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentMethod,
          totalPkr,
          bankTransferReference,
          ...this.providerColumns(paymentQuote),
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

    const session = await this.startProviderSession(order);

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'custom_request_status_update',
        title: 'Custom request quote approved',
        message: `Custom request #${request.requestNumber} was approved and order #${order.id} created (${totalPkr} PKR), awaiting payment confirmation.`,
        relatedOrderId: order.id.toString(),
        relatedCustomRequestId: request.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    this.logger.log(`Order ${order.id} created from custom request ${request.id} by customer ${customerId}`);
    await this.recordPurchased(order.id, customerId);
    return toOrderDto(await this.reload(order.id), undefined, session);
  }

  // AC-11 — fired once per order, right after creation, across all three creation paths (cart
  // checkout, admin quote-conversion, customer custom-request quote-approval). Keyed on order.id
  // alone: an Order row is created exactly once by definition (autoincrement id), so no further
  // idempotency component is needed here.
  private async recordPurchased(orderId: bigint, customerId: bigint): Promise<void> {
    await this.activity.record({
      customerId,
      eventType: 'PURCHASED',
      orderId,
      source: 'web',
      idempotencyKey: `${customerId}:PURCHASED:${orderId}`,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Provider payments (AC-1 PayPal / AC-10 Stripe)
  // ---------------------------------------------------------------------------------------------

  // Refuses (503) before anything is written when the chosen provider isn't configured or no usable
  // exchange rate exists, otherwise returns the PKR -> provider-currency quote that gets LOCKED on
  // the order. Null for bank transfer and for a zero amount due (nothing to charge anyone).
  private async preparePayment(method: PaymentMethod, amountDuePkr: number): Promise<PaymentQuote | null> {
    if (method === 'bank_transfer' || amountDuePkr <= 0) return null;
    const available = method === 'paypal' ? this.paypal.canCreatePayments() : this.stripe.canCreatePayments();
    if (!available) {
      throw new ApiException('PAYMENT_METHOD_UNAVAILABLE', 503, `${method === 'paypal' ? 'PayPal' : 'Card'} payments are not available right now. Please choose another payment method.`);
    }
    return this.paymentAmounts.quote(amountDuePkr);
  }

  private providerColumns(quote: PaymentQuote | null) {
    return quote ? { providerCurrency: quote.currency, providerAmountMinor: quote.amountMinor, providerRateToPkr: quote.rateToPkr, providerChargePkr: quote.amountPkr } : {};
  }

  private webBaseUrl(): string {
    return this.config.get('WEB_BASE_URL', { infer: true }).replace(/\/+$/, '');
  }

  // Creates the provider-side payment for an order that already has its amount locked, records the
  // provider reference on the order, and returns what the browser needs to start paying. Returns
  // null (order stays payment_pending, retryable via getPaymentSession) if the provider call fails.
  private async startProviderSession(order: Order): Promise<PaymentSessionDto | null> {
    if (order.paymentMethod === 'bank_transfer') return null;
    if (!order.providerCurrency || order.providerAmountMinor === null) return null;

    const currency = order.providerCurrency;
    const amountMinor = order.providerAmountMinor;
    const amount = minorToDecimal(amountMinor);

    if (order.paymentMethod === 'paypal') {
      const web = this.webBaseUrl();
      const created = await this.paypal.createOrder({
        referenceId: order.id.toString(),
        currency,
        amountDecimal: amount,
        description: `CZ Digitizing order #${order.id}`,
        returnUrl: `${web}/checkout/pay/${order.id}?paypal=return`,
        cancelUrl: `${web}/checkout/pay/${order.id}?paypal=cancel`,
        requestId: `czd-order-${order.id}-${order.paypalOrderId ?? 'first'}`,
      });
      if (!created?.approveUrl) {
        this.logger.error(`PayPal did not return an approval link for order ${order.id}`);
        return null;
      }
      await this.prisma.order.update({ where: { id: order.id }, data: { paypalOrderId: created.paypalOrderId } });
      return { provider: 'paypal', approveUrl: created.approveUrl, clientSecret: null, publishableKey: null, currency, amount, amountMinor };
    }

    const created = await this.stripe.createPaymentIntent({
      referenceId: order.id.toString(),
      currency,
      amountMinor,
      idempotencyKey: `czd-order-${order.id}-pi-${order.stripePaymentIntentId ?? 'first'}`,
    });
    if (!created?.clientSecret) {
      this.logger.error(`Stripe did not return a client secret for order ${order.id}`);
      return null;
    }
    await this.prisma.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: created.paymentIntentId } });
    return { provider: 'stripe', approveUrl: null, clientSecret: created.clientSecret, publishableKey: this.stripe.publishableKey(), currency, amount, amountMinor };
  }

  // POST /api/orders/:id/payment-session — (re)start payment for one's own unpaid provider order:
  // page reload, a declined card, an expired PayPal order, or a provider outage at checkout. The
  // amount is always the one locked at order creation (re-locked only for an old order that never
  // had one), so the customer is never re-priced behind their back.
  async getPaymentSession(orderId: string, customerId: bigint): Promise<PaymentSessionDto> {
    let order = await this.findOwned(orderId, customerId);
    this.assertProviderOrder(order);
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already paid');
    if (order.status !== 'payment_pending') throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} is "${order.status}" and can no longer be paid`);

    if (order.providerAmountMinor === null || !order.providerCurrency) {
      const dueRaw = Number(order.totalPkr) - Number(order.creditsUsed);
      const paymentQuote = await this.preparePayment(order.paymentMethod, dueRaw);
      if (!paymentQuote) throw new ApiException('ORDER_NOT_PAYABLE', 409, 'Nothing is due on this order');
      order = await this.prisma.order.update({ where: { id: order.id }, data: this.providerColumns(paymentQuote) });
    } else if (order.paymentMethod === 'paypal' ? !this.paypal.canCreatePayments() : !this.stripe.canCreatePayments()) {
      throw new ApiException('PAYMENT_METHOD_UNAVAILABLE', 503, 'This payment method is not available right now. Please try again later or contact support.');
    }

    const currency = order.providerCurrency!;
    const amountMinor = order.providerAmountMinor!;
    const amount = minorToDecimal(amountMinor);

    if (order.paymentMethod === 'paypal' && order.paypalOrderId) {
      const state = await this.paypal.getOrder(order.paypalOrderId);
      if (state?.status === 'COMPLETED') {
        await this.verifyWithProvider(order); // paid in the meantime — settle it server-side
        throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already paid');
      }
      if (state && state.approveUrl && ['CREATED', 'PAYER_ACTION_REQUIRED', 'SAVED', 'APPROVED'].includes(state.status)) {
        return { provider: 'paypal', approveUrl: state.approveUrl, clientSecret: null, publishableKey: null, currency, amount, amountMinor };
      }
    }

    if (order.paymentMethod === 'stripe' && order.stripePaymentIntentId) {
      const intent = await this.stripe.retrievePaymentIntent(order.stripePaymentIntentId);
      if (intent?.status === 'succeeded') {
        await this.verifyWithProvider(order);
        throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already paid');
      }
      if (intent?.client_secret && ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(intent.status)) {
        return { provider: 'stripe', approveUrl: null, clientSecret: intent.client_secret, publishableKey: this.stripe.publishableKey(), currency, amount, amountMinor };
      }
    }

    const session = await this.startProviderSession(order);
    if (!session) throw new ApiException('PAYMENT_PROVIDER_ERROR', 502, 'We could not reach the payment provider. Please try again in a moment.');
    return session;
  }

  // POST /api/orders/:id/verify-payment (customer, own order) and /reverify-payment (Admin, any
  // order) — the SERVER asks the provider what actually happened and confirms only from that. The
  // browser's "I paid" is never trusted: a client cannot make this succeed for an unpaid order.
  async verifyPayment(orderId: string, scope: { customerId?: bigint }): Promise<OrderDto> {
    const order = scope.customerId !== undefined ? await this.findOwned(orderId, scope.customerId) : await this.findOrThrow(orderId);
    this.assertProviderOrder(order);

    if (order.paymentStatus !== 'completed') {
      // A cancelled/refunded order must never be captured: the money would land with no order to
      // attach it to.
      if (order.status !== 'payment_pending') throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} is "${order.status}" and can no longer be paid`);
      await this.verifyWithProvider(order);
    }

    return toOrderDto(await this.reload(order.id));
  }

  private async verifyWithProvider(order: Order): Promise<void> {
    if (order.paymentMethod === 'paypal') {
      if (!order.paypalOrderId) throw new ApiException('PAYMENT_NOT_STARTED', 409, 'No PayPal payment has been started for this order');
      let state = await this.paypal.getOrder(order.paypalOrderId);
      if (!state) throw new ApiException('PAYMENT_PROVIDER_ERROR', 502, 'We could not reach PayPal to verify this payment. Please try again in a moment.');

      if (state.status === 'APPROVED') {
        // Check what PayPal is about to collect BEFORE capturing — never take money we would then
        // have to refuse.
        if (state.orderAmount && !this.matchesLockedAmount(order, state.orderAmount.currency, decimalToMinor(state.orderAmount.value))) {
          this.logger.error(`PayPal order ${order.paypalOrderId} for order ${order.id} is for ${state.orderAmount.currency} ${state.orderAmount.value}, expected ${order.providerCurrency} ${order.providerAmountMinor} minor — NOT capturing`);
          throw new ApiException('PAYMENT_AMOUNT_MISMATCH', 409, 'The PayPal payment does not match this order, so it was not captured. Please contact support.');
        }
        state = await this.paypal.captureOrder(order.paypalOrderId, `czd-capture-${order.id}`);
        if (!state) throw new ApiException('PAYMENT_PROVIDER_ERROR', 502, 'PayPal could not complete the capture right now. Please try again in a moment.');
      }

      if (state.status !== 'COMPLETED') {
        throw new ApiException('PAYMENT_NOT_APPROVED', 409, 'This PayPal payment has not been approved yet. Please complete the payment on PayPal.');
      }
      const capture = state.captures.find((c) => c.status === 'COMPLETED');
      if (!capture) return; // capture still pending at PayPal — the PAYMENT.CAPTURE.COMPLETED webhook will finish it

      const amountMinor = decimalToMinor(capture.value);
      const outcome = await this.confirmProviderPayment(order.id, {
        method: 'paypal',
        currency: capture.currency,
        amountMinor: amountMinor ?? -1,
        paypalOrderId: order.paypalOrderId,
        paypalCaptureId: capture.id,
      });
      if (outcome === 'rejected') throw new ApiException('PAYMENT_AMOUNT_MISMATCH', 409, 'The payment received does not match this order. Please contact support.');
      return;
    }

    if (!order.stripePaymentIntentId) throw new ApiException('PAYMENT_NOT_STARTED', 409, 'No card payment has been started for this order');
    const intent = await this.stripe.retrievePaymentIntent(order.stripePaymentIntentId);
    if (!intent) throw new ApiException('PAYMENT_PROVIDER_ERROR', 502, 'We could not reach our card processor to verify this payment. Please try again in a moment.');
    if (intent.status !== 'succeeded') return; // still requires action / processing — nothing to confirm yet

    const outcome = await this.confirmProviderPayment(order.id, {
      method: 'stripe',
      currency: intent.currency,
      amountMinor: intent.amount_received,
      stripePaymentIntentId: intent.id,
    });
    if (outcome === 'rejected') throw new ApiException('PAYMENT_AMOUNT_MISMATCH', 409, 'The payment received does not match this order. Please contact support.');
  }

  private matchesLockedAmount(order: Pick<Order, 'providerCurrency' | 'providerAmountMinor'>, currency: string, amountMinor: number | null): boolean {
    return order.providerCurrency !== null && order.providerAmountMinor !== null && amountMinor !== null && currency.toUpperCase() === order.providerCurrency.toUpperCase() && amountMinor === order.providerAmountMinor;
  }

  // AC-1/AC-10 — the ONE place a PayPal/Stripe payment confirms an order, whether it arrives via a
  // signed webhook or the server's own read of the provider. Order of checks matters: a valid
  // signature only proves the provider sent the event, so before anything transitions the order
  // must (1) exist and use this provider, (2) not already be paid, (3) still be payable,
  // (4) carry the provider reference it was created with, and (5) the amount AND currency the
  // provider says it received must equal the amount locked on the order. Anything else is logged
  // and changes nothing — no files, no notification, no state change.
  async confirmProviderPayment(orderId: bigint, evidence: ProviderPaymentEvidence): Promise<ProviderConfirmationOutcome> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.error(`${evidence.method} payment event for unknown order ${orderId} — ignoring`);
      return 'ignored';
    }
    if (order.paymentMethod !== evidence.method) {
      this.logger.error(`${evidence.method} payment event for order ${orderId}, which uses ${order.paymentMethod} — rejecting`);
      return 'rejected';
    }
    if (order.paymentStatus === 'completed') {
      this.logger.log(`Order ${orderId} is already paid — ignoring duplicate ${evidence.method} confirmation`);
      return 'already_confirmed';
    }
    if (order.status !== 'payment_pending') {
      // Money arrived for an order that is no longer payable (e.g. cancelled mid-payment): never
      // resurrect it — flag loudly so Admin can refund at the provider.
      this.logger.error(`${evidence.method} payment received for order ${orderId} in status "${order.status}" — NOT confirming; manual refund at the provider may be required`);
      return 'ignored';
    }
    if (order.providerCurrency === null || order.providerAmountMinor === null) {
      this.logger.error(`Order ${orderId} has no locked provider amount — refusing to confirm a ${evidence.method} payment (fail closed)`);
      return 'rejected';
    }

    const referenceOk =
      evidence.method === 'paypal' ? Boolean(order.paypalOrderId) && evidence.paypalOrderId === order.paypalOrderId : Boolean(order.stripePaymentIntentId) && evidence.stripePaymentIntentId === order.stripePaymentIntentId;
    if (!referenceOk) {
      this.logger.error(`${evidence.method} payment for order ${orderId} carries a provider reference that does not match the one on file — rejecting`);
      return 'rejected';
    }

    if (!this.matchesLockedAmount(order, evidence.currency, evidence.amountMinor)) {
      this.logger.error(
        `${evidence.method} payment amount MISMATCH for order ${orderId}: expected ${order.providerCurrency} ${order.providerAmountMinor} minor units, provider reported ${evidence.currency.toUpperCase()} ${evidence.amountMinor} — NOT confirming`,
      );
      return 'rejected';
    }

    const claimed = await this.claimPayment(orderId, {
      paypalOrderId: evidence.paypalOrderId,
      paypalCaptureId: evidence.paypalCaptureId,
      stripePaymentIntentId: evidence.stripePaymentIntentId,
    });
    if (!claimed) return 'already_confirmed'; // a concurrent duplicate won the race — it does the release/notify
    await this.releaseFilesAndNotify(claimed);
    return 'confirmed';
  }

  // The single-winner transition into payment_confirmed for the non-receipt paths. The WHERE clause
  // is the lock: only a still-payable payment_pending order matches, so of any number of concurrent
  // or replayed confirmations exactly one gets count === 1 and goes on to release files/notify.
  private async claimPayment(orderId: bigint, extra: Prisma.OrderUpdateManyMutationInput): Promise<OrderWithRelations | null> {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: 'payment_pending', paymentStatus: { in: PAYABLE_PAYMENT_STATUSES } },
      data: { ...extra, status: 'payment_confirmed', paymentStatus: 'completed' },
    });
    return result.count === 1 ? this.reload(orderId) : null;
  }

  private async settleCoveredByCredits(orderId: bigint): Promise<void> {
    const claimed = await this.claimPayment(orderId, {});
    if (claimed) await this.releaseFilesAndNotify(claimed);
  }

  // AC-1 — webhook's real, DB-backed lookup: never trust a bare id echoed back by the provider,
  // always resolve through a reference this service itself wrote at order-creation time.
  async findByPaypalOrderId(paypalOrderId: string): Promise<bigint | null> {
    const order = await this.prisma.order.findFirst({ where: { paypalOrderId } });
    return order?.id ?? null;
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
  // deliberately NOT reachable here (see isPaymentGatedStatus): a payment is confirmed only by a
  // verified provider payment, an approved bank-transfer receipt, or credits covering the order.
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
    if (order.paymentMethod !== 'bank_transfer') throw new ApiException('VALIDATION_ERROR', 400, 'This order does not use bank transfer');
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

  // POST /api/orders/:id/payment-confirmation — AC-5. Confirm releases files and moves the order
  // to payment_confirmed; reject leaves it payment_pending (so the customer can re-upload on the
  // SAME order — spec §8 risk #4) and tells them why. Approval is only possible for a bank-transfer
  // order that is still awaiting payment and whose latest receipt is still pending review — a
  // cancelled/refunded order can never be revived, and a receipt already reviewed can't be
  // re-approved. Receipt claim + order transition happen in one transaction, so a failed
  // transition leaves the receipt untouched.
  async reviewPaymentConfirmation(orderId: string, dto: PaymentConfirmationDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: this.toId(orderId) }, include: { receipts: { orderBy: { uploadedAt: 'desc' }, take: 1 } } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (order.paymentMethod !== 'bank_transfer') throw new ApiException('VALIDATION_ERROR', 400, 'Only bank-transfer orders have receipts to review');
    if (order.paymentStatus === 'completed') throw new ApiException('ORDER_ALREADY_CONFIRMED', 409, 'This order is already payment-confirmed');
    if (order.status !== 'payment_pending') throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} is "${order.status}" — a receipt can no longer confirm its payment`);

    const latestReceipt = order.receipts[0];
    if (!latestReceipt) throw new ApiException('RECEIPT_REQUIRED', 422, 'No receipt has been uploaded for this order yet');
    if (latestReceipt.reviewStatus !== 'pending') throw new ApiException('RECEIPT_REQUIRED', 422, 'The latest receipt has already been reviewed — the customer must upload a new one');

    const rejectionReason = dto.approve ? null : (dto.rejectionReason?.trim().slice(0, 500) || null);

    await this.prisma.$transaction(async (tx) => {
      const claimedReceipt = await tx.paymentReceipt.updateMany({
        where: { id: latestReceipt.id, reviewStatus: 'pending' },
        data: { reviewStatus: dto.approve ? 'confirmed' : 'rejected', reviewedByAdminId: BigInt(admin.sub), reviewedAt: new Date(), rejectionReason },
      });
      if (claimedReceipt.count !== 1) throw new ApiException('ORDER_STATE_CHANGED', 409, 'This receipt was just reviewed by someone else');

      if (dto.approve) {
        const moved = await tx.order.updateMany({
          where: { id: order.id, status: 'payment_pending', paymentStatus: { in: PAYABLE_PAYMENT_STATUSES } },
          data: { status: 'payment_confirmed', paymentStatus: 'completed' },
        });
        if (moved.count !== 1) throw new ApiException('ORDER_NOT_PAYABLE', 409, `Order #${order.id} changed state — it can no longer be confirmed by this receipt`);
      }
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: dto.approve ? 'ORDER_RECEIPT_APPROVED' : 'ORDER_RECEIPT_REJECTED',
      resourceType: 'order',
      resourceId: order.id.toString(),
      changes: { receiptId: latestReceipt.id.toString(), ...(rejectionReason ? { reason: rejectionReason } : {}) },
    });

    if (dto.approve) {
      await this.releaseFilesAndNotify(await this.reload(order.id));
    } else {
      await this.notifications.notify({
        recipientUserId: order.customerId.toString(),
        type: 'order_status_change',
        title: 'Receipt rejected',
        message: rejectionReason
          ? `Your payment receipt for order #${order.id} was rejected: ${rejectionReason}`
          : `Your payment receipt for order #${order.id} was rejected. Please upload a new receipt.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return this.getForAdmin(orderId);
  }

  // ---------------------------------------------------------------------------------------------
  // Refunds (AC-11) — behaviour intentionally unchanged in this iteration; see spec §8.
  // ---------------------------------------------------------------------------------------------

  // AC-11 — real state-machine support: sets refundedAmountPkr/paymentStatus and moves `status` to
  // `refunded` only for a full refund (a partial refund keeps the order's fulfillment status as-is
  // — spec §8 risk #2 leaves "does it re-lock files" Open, so file access is deliberately left
  // untouched here rather than guessed at; see customer-files.service.ts's own TODO comment on
  // this same open question). NOTE: this records the refund in this system only — it does NOT call
  // PayPal/Stripe, so money is not returned by this method. Credit-ledger reversal is real for a
  // full refund.
  async refund(orderId: string, dto: RefundOrderDto, admin: AccessTokenPayload): Promise<OrderDto> {
    const order = await this.findOrThrow(orderId);
    if (order.paymentStatus !== 'completed' && order.paymentStatus !== 'partially_refunded') {
      throw new ApiException('VALIDATION_ERROR', 400, 'Only a payment-confirmed order can be refunded');
    }
    const amountPkr = dto.amountPkr ?? Number(order.totalPkr);
    if (amountPkr > Number(order.totalPkr)) throw new ApiException('VALIDATION_ERROR', 400, 'Refund amount exceeds order total');
    const isFullRefund = amountPkr >= Number(order.totalPkr);

    if (isFullRefund && Number(order.creditsUsed) > 0) await this.credits.reverseUsageOnOrder(order.id, Number(order.creditsUsed));

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

  private assertProviderOrder(order: Order): void {
    if (order.paymentMethod === 'bank_transfer') throw new ApiException('VALIDATION_ERROR', 400, 'This order is paid by bank transfer, not through a payment provider');
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

    // The WHERE pins the status we validated against, so two admins (or an admin racing a webhook)
    // can't both apply a transition computed from the same stale read.
    const moved = await this.prisma.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: nextStatus } });
    if (moved.count !== 1) throw new ApiException('ORDER_STATE_CHANGED', 409, `Order #${order.id} changed while it was being updated — reload and try again`);
    const updated = await this.reload(order.id);

    await this.notifications.notify({
      recipientUserId: order.customerId.toString(),
      type: 'order_status_change',
      title: 'Order status updated',
      message: `Order #${order.id} is now "${nextStatus}".`,
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
    if (order.paymentMethod === 'bank_transfer') {
      const receipts = await this.prisma.paymentReceipt.count({ where: { orderId: order.id } });
      if (receipts === 0) return new ApiException('RECEIPT_REQUIRED', 422, 'A bank-transfer order can only be confirmed by reviewing an uploaded receipt — none has been uploaded');
      return new ApiException('PAYMENT_CONFIRMATION_REQUIRED', 409, 'Payment can only be confirmed by approving the uploaded receipt (Confirm Payment), not by changing the status');
    }
    return new ApiException('PAYMENT_CONFIRMATION_REQUIRED', 409, 'Payment is confirmed only from a verified provider payment (use "Re-check with provider"), not by changing the status');
  }

  // AC-1/AC-5/AC-6 — the file-release step every state transition into payment_confirmed must go
  // through, real and not stubbed (flagged as a critical bug in the spec's own rollout section if
  // silently broken). Snapshots the resolved file set at THIS moment — a design's files or, for a
  // bundle line, every member design's current files via BundlesService.getAuthorizedFileTargets —
  // into CustomerAuthorizedFile rows, never re-derived later, so a subsequent bundle-membership
  // change never retroactively revokes or grants access (mirrors bundles.service.ts's own AC-4
  // comment on this). Every caller reaches this only after winning the single-claim transition
  // into payment_confirmed, so it runs exactly once per order.
  private async releaseFilesAndNotify(order: OrderWithRelations): Promise<void> {
    // AC-11 — fired once, here, regardless of which call site drove the payment_confirmed
    // transition — this is the single choke point they all funnel through.
    await this.activity.record({
      customerId: order.customerId,
      eventType: 'PAID',
      orderId: order.id,
      source: 'web',
      idempotencyKey: `${order.customerId}:PAID:${order.id}`,
    });

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
