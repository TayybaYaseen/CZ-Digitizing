import type { FileFormatRequestDto } from '@czd/shared-types';
import type { FileFormatRequest } from '../../generated/prisma';

export function toFileFormatRequestDto(row: FileFormatRequest): FileFormatRequestDto {
  return {
    id: row.id.toString(),
    orderId: row.orderId.toString(),
    customerId: row.customerId.toString(),
    requestedFormat: row.requestedFormat,
    notes: row.notes,
    status: row.status,
    fulfilledFileId: row.fulfilledFileId ? row.fulfilledFileId.toString() : null,
    createdAt: row.createdAt.toISOString(),
    fulfilledAt: row.fulfilledAt ? row.fulfilledAt.toISOString() : null,
  };
}
