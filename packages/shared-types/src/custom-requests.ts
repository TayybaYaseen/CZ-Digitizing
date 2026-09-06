// Mirrors docs/specs/2026-08-28-12-custom-design-requests.md §3/§4 (aspect A-017).
// Shared between apps/api, apps/web, apps/admin.

export type CustomRequestType = 'embroidery_custom' | 'vector_custom';

// AC-2 — the exact status graph, enforced by custom-request-state-machine.ts.
export type CustomRequestStatus =
  | 'new'
  | 'reviewing'
  | 'quote_sent'
  | 'approved'
  | 'in_production'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'need_more_info'
  | 'revision_required'
  | 'cancelled';

export type CustomRequestPaymentStatus = 'pending' | 'completed' | 'refunded';

export interface CustomRequestReferenceDto {
  id: string;
  imageUrl: string;
  uploadedAt: string;
}

export interface CustomRequestMessageDto {
  id: string;
  customRequestId: string;
  senderUserId: string;
  senderRole: 'customer' | 'admin' | 'freelancer' | 'moderator';
  message: string;
  createdAt: string;
}

export interface CustomRequestFileDto {
  id: string;
  fileFormat: string;
  fileSizeBytes: string;
  downloadCount: number;
  createdAt: string;
}

// AC-7 — full detail view for Admin (and the customer's own reduced view over the same shape).
export interface CustomRequestDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerEmail: string;
  customerWhatsapp: string | null;
  requestType: CustomRequestType;
  status: CustomRequestStatus;
  imageUrl: string | null;
  sizeValue: string | null;
  machineFormat: string;
  fabricType: string | null;
  specialInstructions: string | null;
  quotedPricePkr: string | null;
  finalPricePkr: string | null;
  paymentStatus: CustomRequestPaymentStatus;
  designerId: string | null;
  designerName: string | null;
  adminNotes: string | null;
  orderId: string | null;
  references: CustomRequestReferenceDto[];
  files: CustomRequestFileDto[];
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

export interface CustomRequestSummaryDto {
  id: string;
  requestNumber: string;
  requestType: CustomRequestType;
  status: CustomRequestStatus;
  quotedPricePkr: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FileFormatRequestStatus = 'pending' | 'fulfilled' | 'rejected';

export interface FileFormatRequestDto {
  id: string;
  orderId: string;
  customerId: string;
  requestedFormat: string;
  notes: string | null;
  status: FileFormatRequestStatus;
  fulfilledFileId: string | null;
  createdAt: string;
  fulfilledAt: string | null;
}
