import type { CustomRequestStatus } from '../generated/prisma';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-2 — authoritative state machine:
//   new -> reviewing -> quote_sent -> approved -> in_production -> ready -> delivered -> completed
// with need_more_info/revision_required/cancelled reachable as side-states from
// reviewing/in_production (need_more_info loops back to reviewing once the customer replies;
// revision_required loops back to in_production once the designer addresses it). completed and
// cancelled are terminal — same posture as OrderStatus/order-state-machine.ts.
const TRANSITIONS: Record<CustomRequestStatus, CustomRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['quote_sent', 'need_more_info', 'cancelled'],
  need_more_info: ['reviewing', 'cancelled'],
  quote_sent: ['approved', 'reviewing', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['ready', 'revision_required', 'cancelled'],
  revision_required: ['in_production', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export function isValidCustomRequestTransition(from: CustomRequestStatus, to: CustomRequestStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidCustomRequestTransition(from: CustomRequestStatus, to: CustomRequestStatus): void {
  if (!isValidCustomRequestTransition(from, to)) {
    throw new InvalidCustomRequestTransitionError(from, to);
  }
}

export class InvalidCustomRequestTransitionError extends Error {
  constructor(
    public readonly from: CustomRequestStatus,
    public readonly to: CustomRequestStatus,
  ) {
    super(`Cannot transition custom request from "${from}" to "${to}"`);
  }
}
