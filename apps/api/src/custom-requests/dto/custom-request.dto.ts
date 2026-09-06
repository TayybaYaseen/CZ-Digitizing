import type { CustomRequestDto, CustomRequestFileDto, CustomRequestMessageDto, CustomRequestReferenceDto, CustomRequestSummaryDto } from '@czd/shared-types';
import type { CustomRequest, CustomRequestFile, CustomRequestMessage, CustomRequestReference, User } from '../../generated/prisma';

export type CustomRequestWithRelations = CustomRequest & {
  customer: User;
  designer: User | null;
  references: CustomRequestReference[];
  files: CustomRequestFile[];
};

export function toCustomRequestDto(row: CustomRequestWithRelations): CustomRequestDto {
  return {
    id: row.id.toString(),
    requestNumber: row.requestNumber,
    customerId: row.customerId.toString(),
    customerEmail: row.customer.email,
    customerWhatsapp: row.customer.phone ?? null,
    requestType: row.requestType,
    status: row.status,
    imageUrl: row.imageUrl,
    sizeValue: row.sizeValue,
    machineFormat: row.machineFormat,
    fabricType: row.fabricType,
    specialInstructions: row.specialInstructions,
    quotedPricePkr: row.quotedPricePkr ? row.quotedPricePkr.toString() : null,
    finalPricePkr: row.finalPricePkr ? row.finalPricePkr.toString() : null,
    paymentStatus: row.paymentStatus,
    designerId: row.designerId ? row.designerId.toString() : null,
    designerName: row.designer?.displayName ?? row.designer?.email ?? null,
    adminNotes: row.adminNotes,
    orderId: row.orderId ? row.orderId.toString() : null,
    references: row.references.map(toCustomRequestReferenceDto),
    files: row.files.map(toCustomRequestFileDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}

export function toCustomRequestSummaryDto(row: CustomRequest): CustomRequestSummaryDto {
  return {
    id: row.id.toString(),
    requestNumber: row.requestNumber,
    requestType: row.requestType,
    status: row.status,
    quotedPricePkr: row.quotedPricePkr ? row.quotedPricePkr.toString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCustomRequestReferenceDto(row: CustomRequestReference): CustomRequestReferenceDto {
  return {
    id: row.id.toString(),
    imageUrl: row.imageUrl,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export function toCustomRequestFileDto(row: CustomRequestFile): CustomRequestFileDto {
  return {
    id: row.id.toString(),
    fileFormat: row.fileFormat,
    fileSizeBytes: row.fileSizeBytes.toString(),
    downloadCount: row.downloadCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCustomRequestMessageDto(row: CustomRequestMessage & { sender: User }): CustomRequestMessageDto {
  return {
    id: row.id.toString(),
    customRequestId: row.customRequestId.toString(),
    senderUserId: row.senderUserId.toString(),
    senderRole: row.sender.role,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}
