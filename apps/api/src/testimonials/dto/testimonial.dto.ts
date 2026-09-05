import type { TestimonialDto } from '@czd/shared-types';
import type { Testimonial } from '../../generated/prisma';

export function toTestimonialDto(row: Testimonial): TestimonialDto {
  return {
    id: row.id.toString(),
    customerName: row.customerName,
    country: row.country,
    business: row.business,
    photoUrl: row.photoUrl,
    rating: row.rating,
    feedback: row.feedback,
    serviceUsed: row.serviceUsed,
    isPublished: row.isPublished,
    source: row.source,
    moderationStatus: row.moderationStatus,
    orderId: row.orderId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
