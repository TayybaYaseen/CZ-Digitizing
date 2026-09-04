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
  localAmount: number | null;
  localCurrencyCode: string | null;
  bankTransferReference: string | null;
  refundedAmountPkr: number | null;
  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-7 — the customer's own credit balance
  // applied against this order's total at checkout; 0 when no credits were used.
  creditsUsed: number;
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

type OrderItemWithNames = OrderItem & { design: { name: string } | null; bundle: { name: string } | null; size: { sizeLabel: string } | null };
export type OrderWithRelations = Order & { items: OrderItemWithNames[]; receipts: PaymentReceipt[] };

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
  };
}

// currencyConversion — AC-8: when the caller (customer's stored preference or a ?currencyCode
// query param) resolves to a non-PKR currency with a known exchange rate, both PKR and the
// converted amount are returned; otherwise localAmount/localCurrencyCode are null. Full
// locale-detection is TODO(A-021) — the caller decides what currencyCode to ask for.
export function toOrderDto(order: OrderWithRelations, currencyConversion?: { currencyCode: string; amountLocal: number }): OrderDto {
  return {
    id: order.id.toString(),
    customerId: order.customerId.toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    transactionType: order.transactionType,
    totalPkr: Number(order.totalPkr),
    localAmount: currencyConversion?.amountLocal ?? null,
    localCurrencyCode: currencyConversion?.currencyCode ?? null,
    bankTransferReference: order.bankTransferReference,
    refundedAmountPkr: order.refundedAmountPkr !== null ? Number(order.refundedAmountPkr) : null,
    creditsUsed: Number(order.creditsUsed),
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
