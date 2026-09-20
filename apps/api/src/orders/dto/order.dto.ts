import type { Order, OrderItem, OrderStatus, OrderPaymentStatus, PaymentMethod, PaymentReceipt, PaymentTransactionType, ReceiptReviewStatus } from '../../generated/prisma';
import { amountDuePkr as computeAmountDuePkr, confirmedReceiptsTotalPkr, outstandingPkr } from '../order-payment.util';
import { orderAllowsFileAccess } from '../order-state-machine';

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
  // The PKR Admin confirmed as received for this receipt; null while pending / when rejected. Less
  // than what was due = a PARTIAL payment (the order stays unpaid and its files stay locked).
  confirmedAmountPkr: number | null;
  // Detected from the file's bytes at upload; the file itself is only ever served to Admin via
  // GET /api/orders/:id/receipts/:receiptId/file (never a public URL, never the storage path).
  contentType: string | null;
  originalFilename: string | null;
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
  // totalPkr minus credits applied: the EXACT PKR amount the customer transfers (0 when credits covered
  // it — then no bank transfer or receipt is needed). Never converted to another currency.
  amountDuePkr: number;
  // Bank money Admin has confirmed so far, and what is STILL unpaid. Files unlock only once the
  // outstanding amount reaches 0 AND the order is confirmed (filesUnlocked) — partial payment never
  // unlocks them, and neither does any refund.
  amountPaidPkr: number;
  amountOutstandingPkr: number;
  // The backend's own file-access decision (orderAllowsFileAccess) — clients display it, they never
  // compute it, and the download routes re-check it on every request regardless.
  filesUnlocked: boolean;
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

// Admin list row: adds who ordered and the bank-transfer review state so the Payments screen can be
// a real receipt queue (AC-4 "the order is flagged for review").
export interface AdminOrderSummaryDto extends OrderSummaryDto {
  customerId: string;
  customerEmail: string;
  customerDisplayName: string | null;
  amountDuePkr: number;
  amountOutstandingPkr: number;
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
    // Quote / custom-request / credit-package / subscription lines have no catalog record — their
    // snapshotted description is the name.
    name: item.design?.name ?? item.bundle?.name ?? item.customDescription ?? 'Unknown item',
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
    confirmedAmountPkr: receipt.confirmedAmountPkr !== null ? Number(receipt.confirmedAmountPkr) : null,
    contentType: receipt.contentType,
    originalFilename: receipt.originalFilename,
  };
}

export function amountDuePkrOf(order: Pick<Order, 'totalPkr' | 'creditsUsed'>): number {
  return computeAmountDuePkr(order);
}

// Still-unpaid amount for an order that can yet be paid; 0 once it is paid/refunded or cancelled.
function amountOutstandingPkrOf(order: OrderWithRelations): number {
  const payable = order.status !== 'cancelled' && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
  return payable ? outstandingPkr(order, order.receipts) : 0;
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
    amountDuePkr: amountDuePkrOf(order),
    amountPaidPkr: confirmedReceiptsTotalPkr(order.receipts),
    amountOutstandingPkr: amountOutstandingPkrOf(order),
    filesUnlocked: orderAllowsFileAccess(order),
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

export function toAdminOrderSummaryDto(order: OrderWithCustomer): AdminOrderSummaryDto {
  // receipts are loaded newest-first (ORDER_INCLUDE), so [0] is the latest.
  const latest = order.receipts[0];
  return {
    ...toOrderSummaryDto(order),
    customerId: order.customerId.toString(),
    customerEmail: order.customer.email,
    customerDisplayName: order.customer.displayName,
    amountDuePkr: amountDuePkrOf(order),
    amountOutstandingPkr: amountOutstandingPkrOf(order),
    bankTransferReference: order.bankTransferReference,
    latestReceipt: latest ? { id: latest.id.toString(), uploadedAt: latest.uploadedAt.toISOString(), reviewStatus: latest.reviewStatus, contentType: latest.contentType } : null,
  };
}
