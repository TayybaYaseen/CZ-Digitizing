import type { OrderStatus } from '../generated/prisma';

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

// AC-6 — "anything after payment" per the spec's own wording: gates file access on every status
// that comes at or after payment_confirmed in the happy-path chain. Explicitly excludes
// cancelled/refunded even though refunded is reachable from e.g. `processing` — AC-11's "access is
// re-evaluated per Admin policy" is the open question flagged in customer-files.service.ts, not an
// automatic continuation of access after a refund.
const FILE_RELEASE_STATUSES: OrderStatus[] = ['payment_confirmed', 'processing', 'ready', 'completed'];

export function statusAllowsFileAccess(status: OrderStatus): boolean {
  return FILE_RELEASE_STATUSES.includes(status);
}
