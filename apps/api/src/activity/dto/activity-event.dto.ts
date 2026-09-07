import type { ActivityEvent } from '../../generated/prisma';

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019), AC-13/AC-14.
export interface ActivityEventDto {
  id: string;
  eventType: ActivityEvent['eventType'];
  source: ActivityEvent['source'];
  designId?: string;
  orderId?: string;
  cartItemId?: string;
  fileId?: string;
  createdAt: string;
}

export function toActivityEventDto(row: ActivityEvent): ActivityEventDto {
  return {
    id: row.id.toString(),
    eventType: row.eventType,
    source: row.source,
    designId: row.designId?.toString(),
    orderId: row.orderId?.toString(),
    cartItemId: row.cartItemId ?? undefined,
    fileId: row.fileId?.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}
