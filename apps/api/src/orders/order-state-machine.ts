import type { OrderPaymentStatus, OrderStatus } from '../generated/prisma';

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 — authoritative state machine:
//   pending -> payment_pending -> payment_confirmed -> processing -> ready -> completed
//                       ^-------- (rejected receipt) -------|
//                       \-> cancelled
// Plus `refunded`, reachable from payment_confirmed/processing/ready/completed per AC-11 (a refund
// can be issued any time after payment was confirmed, not only from a terminal state).
// cancelled/refunded/completed are terminal — nothing transitions out of them here; a future
// re-open would be a deliberate, separate decision, not an accidental fall-through.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['payment_pending', 'cancelled'],
  payment_pending: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['processing', 'refunded', 'cancelled'],
  processing: ['ready', 'refunded', 'cancelled'],
  ready: ['completed', 'refunded', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!isValidOrderTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Cannot transition order from "${from}" to "${to}"`);
  }
}

// A-013 — statuses that may ONLY be entered through their own verified flow, never through the
// generic manual PUT /api/orders/:id/status: `payment_confirmed` means money was actually received
// (a verified provider payment, an approved bank-transfer receipt, or credits fully covering the
// order) and `refunded` must move paymentStatus/credits in step (PUT /:id/refund). Letting an
// arbitrary status update land on either would simulate a payment (and release files) or leave the
// order in an inconsistent money state.
const PAYMENT_GATED_STATUSES: OrderStatus[] = ['payment_confirmed', 'refunded'];

export function isPaymentGatedStatus(status: OrderStatus): boolean {
  return PAYMENT_GATED_STATUSES.includes(status);
}

// AC-6 — "anything after payment" per the spec's own wording: the statuses at or after
// payment_confirmed in the happy-path chain. Explicitly excludes cancelled/refunded. This is only
// HALF of the file-access rule — see orderAllowsFileAccess() below, which is what every gate uses.
const FILE_RELEASE_STATUSES: OrderStatus[] = ['payment_confirmed', 'processing', 'ready', 'completed'];

export function statusAllowsFileAccess(status: OrderStatus): boolean {
  return FILE_RELEASE_STATUSES.includes(status);
}

// A-013 FINAL PAYMENT ACCESS POLICY — customer files are unlocked ONLY after 100% of the order amount
// has been paid and an authorized admin has confirmed it. Partial payment never unlocks files, and any
// refund (partial included) re-locks them, because after a refund the order is no longer fully paid.
//
// `paymentStatus === 'completed'` is only ever written by the two single-claim paths that verify the
// FULL amount (an admin approving the receipt that brings confirmed payments + credits up to the
// total, or credits covering the whole order) — so it means "fully paid and confirmed". Anything else
// (pending, failed, partially_refunded, refunded) keeps files locked, as does a cancelled order. A
// recorded refund amount is checked too, as a belt-and-braces guard should paymentStatus ever lag it.
// Every file-access path (list, download token, extra-format requests, custom-request deliverables)
// must call THIS, never `statusAllowsFileAccess` on its own.
export function orderAllowsFileAccess(order: { status: OrderStatus; paymentStatus: OrderPaymentStatus; refundedAmountPkr: { toString(): string } | number | null }): boolean {
  return statusAllowsFileAccess(order.status) && order.paymentStatus === 'completed' && !(Number(order.refundedAmountPkr ?? 0) > 0);
}
