import type { Order, OrderItem, OrderStatus, OrderPaymentStatus, PaymentMethod, PaymentReceipt, PaymentTransactionType, ReceiptReviewStatus } from '../../generated/prisma';

export interface OrderItemDto {
  id: string;
  designId: string | null;
  bundleId: string | null;
  name: string;
  sizeId: string | null;
  sizeLabel: string | null;
  quantity: number;
  unitPricePkr: number;
  linePricePkr: number;
}

export interface PaymentReceiptDto {
  id: string;
  uploadedAt: string;
  reviewStatus: ReceiptReviewStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  // Detected from the file's bytes at upload; the file itself is only ever served to Admin via
  // GET /api/orders/:id/receipts/:receiptId/file (never a public URL, never the storage path).
  contentType: string | null;
  originalFilename: string | null;
}

// A-013 — what the payment provider was asked to collect for this order, LOCKED at order creation
// and traceable back to the PKR total: amountPkr (what the customer owes after credits) at
// rateToPkr became `amount` in `currency` (= amountMinor in that currency's smallest unit).
export interface ProviderChargeDto {
  currency: string;
  amount: string;
  amountMinor: number;
  amountPkr: number;
  rateToPkr: number;
}

// A-013 — everything the browser needs to START a provider payment. Returned by checkout and by
// POST /api/orders/:id/payment-session. Nothing in here confirms a payment: the order only becomes
// payment_confirmed after the SERVER verifies the provider's own state (webhook or verify-payment).
export interface PaymentSessionDto {
  provider: 'paypal' | 'stripe';
  // PayPal: redirect the buyer here to approve; PayPal returns them to /checkout/pay/:id.
  approveUrl: string | null;
  // Stripe: mount the Payment Element with this (+ publishableKey); it runs 3-D Secure itself.
  clientSecret: string | null;
  publishableKey: string | null;
  currency: string;
  amount: string;
  amountMinor: number;
}

// AC-8 — localAmount/localCurrencyCode are only populated when the caller asked for a conversion
// (see OrdersService.toOrderDto's currencyCode parameter); otherwise both are null, and the
// customer sees PKR only, which remains correct in every case (PKR is always the source of truth).
export interface OrderDto {
  id: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: PaymentMethod;
  transactionType: PaymentTransactionType;
  totalPkr: number;
  // totalPkr minus credits applied: what the customer still has to pay (0 when credits covered it).
  amountDuePkr: number;
  localAmount: number | null;
  localCurrencyCode: string | null;
  bankTransferReference: string | null;
  refundedAmountPkr: number | null;
  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-7 — the customer's own credit balance
  // applied against this order's total at checkout; 0 when no credits were used.
  creditsUsed: number;
  providerCharge: ProviderChargeDto | null;
  // Only set on the checkout response (and never persisted) — see PaymentSessionDto.
  payment: PaymentSessionDto | null;
  items: OrderItemDto[];
  receipts: PaymentReceiptDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummaryDto {
  id: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: PaymentMethod;
  totalPkr: number;
  itemCount: number;
  createdAt: string;
}

// Admin list row: adds who ordered and the bank-transfer review state so the Payments screen can be
// a real receipt queue (AC-4 "the order is flagged for review").
export interface AdminOrderSummaryDto extends OrderSummaryDto {
  customerId: string;
  customerEmail: string;
  customerDisplayName: string | null;
  amountDuePkr: number;
  bankTransferReference: string | null;
  latestReceipt: { id: string; uploadedAt: string; reviewStatus: ReceiptReviewStatus; contentType: string | null } | null;
}

type OrderItemWithNames = OrderItem & { design: { name: string } | null; bundle: { name: string } | null; size: { sizeLabel: string } | null };
export type OrderWithRelations = Order & { items: OrderItemWithNames[]; receipts: PaymentReceipt[] };
export type OrderWithCustomer = OrderWithRelations & { customer: { email: string; displayName: string | null } };

function toItemDto(item: OrderItemWithNames): OrderItemDto {
  const unitPricePkr = Number(item.unitPricePkr);
  return {
    id: item.id.toString(),
    designId: item.designId?.toString() ?? null,
    bundleId: item.bundleId?.toString() ?? null,
    name: item.design?.name ?? item.bundle?.name ?? 'Unknown item',
    sizeId: item.sizeId?.toString() ?? null,
    sizeLabel: item.size?.sizeLabel ?? null,
    quantity: item.quantity,
    unitPricePkr,
    linePricePkr: unitPricePkr * item.quantity,
  };
}

function toReceiptDto(receipt: PaymentReceipt): PaymentReceiptDto {
  return {
    id: receipt.id.toString(),
    uploadedAt: receipt.uploadedAt.toISOString(),
    reviewStatus: receipt.reviewStatus,
    reviewedAt: receipt.reviewedAt?.toISOString() ?? null,
    rejectionReason: receipt.rejectionReason,
    contentType: receipt.contentType,
    originalFilename: receipt.originalFilename,
  };
}

export function amountDuePkrOf(order: Pick<Order, 'totalPkr' | 'creditsUsed'>): number {
  return Math.max(0, Number(order.totalPkr) - Number(order.creditsUsed));
}

function toProviderChargeDto(order: Order): ProviderChargeDto | null {
  if (!order.providerCurrency || order.providerAmountMinor === null || order.providerRateToPkr === null || order.providerChargePkr === null) return null;
  const minor = order.providerAmountMinor;
  return {
    currency: order.providerCurrency,
    amount: `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`,
    amountMinor: minor,
    amountPkr: Number(order.providerChargePkr),
    rateToPkr: Number(order.providerRateToPkr),
  };
}

// currencyConversion — AC-8: when the caller (customer's stored preference or a ?currencyCode
// query param) resolves to a non-PKR currency with a known exchange rate, both PKR and the
// converted amount are returned; otherwise localAmount/localCurrencyCode are null. Full
// locale-detection is TODO(A-021) — the caller decides what currencyCode to ask for.
export function toOrderDto(order: OrderWithRelations, currencyConversion?: { currencyCode: string; amountLocal: number }, payment: PaymentSessionDto | null = null): OrderDto {
  return {
    id: order.id.toString(),
    customerId: order.customerId.toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    transactionType: order.transactionType,
    totalPkr: Number(order.totalPkr),
    amountDuePkr: amountDuePkrOf(order),
    localAmount: currencyConversion?.amountLocal ?? null,
    localCurrencyCode: currencyConversion?.currencyCode ?? null,
    bankTransferReference: order.bankTransferReference,
    refundedAmountPkr: order.refundedAmountPkr !== null ? Number(order.refundedAmountPkr) : null,
    creditsUsed: Number(order.creditsUsed),
    providerCharge: toProviderChargeDto(order),
    payment,
    items: order.items.map(toItemDto),
    receipts: order.receipts.map(toReceiptDto),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toOrderSummaryDto(order: OrderWithRelations): OrderSummaryDto {
  return {
    id: order.id.toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalPkr: Number(order.totalPkr),
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    createdAt: order.createdAt.toISOString(),
  };
}

export function toAdminOrderSummaryDto(order: OrderWithCustomer): AdminOrderSummaryDto {
  // receipts are loaded newest-first (ORDER_INCLUDE), so [0] is the latest.
  const latest = order.receipts[0];
  return {
    ...toOrderSummaryDto(order),
    customerId: order.customerId.toString(),
    customerEmail: order.customer.email,
    customerDisplayName: order.customer.displayName,
    amountDuePkr: amountDuePkrOf(order),
    bankTransferReference: order.bankTransferReference,
    latestReceipt: latest ? { id: latest.id.toString(), uploadedAt: latest.uploadedAt.toISOString(), reviewStatus: latest.reviewStatus, contentType: latest.contentType } : null,
  };
}
