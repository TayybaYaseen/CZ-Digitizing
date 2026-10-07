import type { AdminTestimonialDto, MyTestimonialDto, PublicTestimonialDto } from '@czd/shared-types';
import type { Testimonial } from '../../generated/prisma';
import { deriveTestimonialStatus } from '../review-text.util';

export type TestimonialWithRelations = Testimonial & {
  customer?: { email: string } | null;
  customRequest?: { requestNumber: string } | null;
};

// docs/specs/2026-10-06-22-customer-review-submission.md §14 — public shape. Deliberately omits
// email, customer/order/custom-request IDs, source, moderation fields, original text and the
// private storage path. `imageUrl` points at the public image route, which itself only serves
// published reviews.
export function toPublicTestimonialDto(row: Testimonial, apiBaseUrl: string): PublicTestimonialDto {
  return {
    id: row.id.toString(),
    customerName: row.customerName,
    country: row.country,
    business: row.business,
    photoUrl: row.photoUrl,
    imageUrl: row.imageStoragePath ? `${apiBaseUrl}/api/testimonials/${row.id}/image` : null,
    rating: row.rating,
    feedback: row.feedback,
    serviceUsed: row.serviceUsed,
    createdAt: row.createdAt.toISOString(),
  };
}

// §11/§26 — Admin moderation view.
export function toAdminTestimonialDto(row: TestimonialWithRelations): AdminTestimonialDto {
  return {
    id: row.id.toString(),
    customerName: row.customerName,
    country: row.country,
    business: row.business,
    photoUrl: row.photoUrl,
    rating: row.rating,
    feedback: row.feedback,
    originalFeedback: row.originalFeedback,
    serviceUsed: row.serviceUsed,
    isPublished: row.isPublished,
    source: row.source,
    moderationStatus: row.moderationStatus,
    status: deriveTestimonialStatus(row),
    customerId: row.customerId?.toString() ?? null,
    customerEmail: row.customer?.email ?? null,
    orderId: row.orderId?.toString() ?? null,
    // Orders have no separate human number; the UI shows "#<id>" everywhere.
    orderNumber: row.orderId?.toString() ?? null,
    customRequestId: row.customRequestId?.toString() ?? null,
    customRequestNumber: row.customRequest?.requestNumber ?? null,
    hasImage: row.imageStoragePath !== null,
    imageOriginalFilename: row.imageOriginalFilename,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// §21 — the customer's own review. No Admin-only fields.
export function toMyTestimonialDto(row: TestimonialWithRelations): MyTestimonialDto {
  return {
    id: row.id.toString(),
    customerName: row.customerName,
    country: row.country,
    rating: row.rating,
    feedback: row.feedback,
    originalFeedback: row.originalFeedback,
    serviceUsed: row.serviceUsed,
    linkedItemLabel: row.orderId ? `#${row.orderId}` : row.customRequest ? row.customRequest.requestNumber : null,
    hasImage: row.imageStoragePath !== null,
    status: deriveTestimonialStatus(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
