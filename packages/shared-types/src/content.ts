// Mirrors docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012, A-012a-f).
// Shared between apps/api, apps/web, apps/admin.

export interface FaqDto {
  id: string;
  question: string;
  answer: string;
  topic: string;
  relatedPage: string | null;
  relatedService: string | null;
  relatedCategory: string | null;
  languageCode: string;
  priority: number;
  taeboVisible: boolean;
  isPublished: boolean;
  helpfulYesCount: number;
  helpfulNoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TipDto {
  id: string;
  title: string;
  content: string;
  category: string;
  languageCode: string;
  isPublished: boolean;
  linkedFaqIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type TestimonialSource = 'admin_curated' | 'customer_submitted';
export type TestimonialModeration = 'approved' | 'pending' | 'rejected';

// A-026 (docs/specs/2026-10-06-22-customer-review-submission.md §10) — derived from
// moderationStatus + isPublished, never stored on its own.
export type TestimonialStatus = 'pending' | 'published' | 'hidden' | 'rejected';

// Spec §14 — the ONLY shape the public endpoints return. No email, customer/order IDs, moderation
// fields, original text or storage path. `id` is an opaque list key / image-URL segment.
export interface PublicTestimonialDto {
  id: string;
  customerName: string;
  country: string | null;
  business: string | null;
  photoUrl: string | null;
  // Absolute API URL of the customer's photo (served only while published), or null.
  imageUrl: string | null;
  rating: number;
  feedback: string;
  serviceUsed: string;
  createdAt: string;
}

// Spec §11/§26 — Admin moderation view (staff routes only).
export interface AdminTestimonialDto {
  id: string;
  customerName: string;
  country: string | null;
  business: string | null;
  photoUrl: string | null;
  rating: number;
  feedback: string;
  originalFeedback: string | null;
  serviceUsed: string;
  isPublished: boolean;
  source: TestimonialSource;
  moderationStatus: TestimonialModeration;
  status: TestimonialStatus;
  customerId: string | null;
  customerEmail: string | null;
  orderId: string | null;
  orderNumber: string | null;
  customRequestId: string | null;
  customRequestNumber: string | null;
  hasImage: boolean;
  imageOriginalFilename: string | null;
  createdAt: string;
  updatedAt: string;
}

// Kept so existing imports keep compiling; the Admin list is the superset shape.
export type TestimonialDto = AdminTestimonialDto;

// Spec §21/§26 — a customer's own review (My Reviews). No Admin-only fields.
export interface MyTestimonialDto {
  id: string;
  customerName: string;
  country: string | null;
  rating: number;
  feedback: string;
  originalFeedback: string | null;
  serviceUsed: string;
  linkedItemLabel: string | null;
  hasImage: boolean;
  status: TestimonialStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReviewableItemKind = 'order' | 'custom_request';

export interface ReviewableItemDto {
  kind: ReviewableItemKind;
  id: string;
  // Human reference, e.g. the order/request number; the client builds the visible label.
  reference: string;
  // Suggested "service used" text (first design/service name), editable by the customer.
  serviceHint: string | null;
  alreadyReviewed: boolean;
}

// Spec §6/§26 — drives the Write a Review form.
export interface ReviewEligibilityDto {
  eligible: boolean;
  items: ReviewableItemDto[];
  pendingCount: number;
  pendingLimit: number;
  suggestedDisplayName: string | null;
}

// Spec §19 — shared limits, used by the API DTOs and both front-end forms.
export const REVIEW_LIMITS = {
  displayNameMin: 2,
  displayNameMax: 80,
  countryMax: 80,
  serviceUsedMin: 2,
  serviceUsedMax: 120,
  feedbackMin: 20,
  feedbackMax: 2000,
  imageMaxBytes: 5 * 1024 * 1024,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  maxPendingPerCustomer: 3,
} as const;

export interface BlogPostSummaryDto {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  category: string;
  languageCode: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface BlogPostDto extends BlogPostSummaryDto {
  body: string;
}

export interface AboutContentDto {
  languageCode: string;
  heading: string;
  body: string;
  imageUrls: string[];
  updatedAt: string;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string | null;
  mediaUrls: string[];
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  // docs/portfolio-spec.md §10.1 (Professional Portfolio enhancement of A-012f) — real
  // work-sample metadata only; CV/biography content is never part of this type.
  isFeatured: boolean;
  originalArtworkUrl: string | null;
  embroideryResultUrl: string | null;
  closeUpImageUrl: string | null;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  softwareUsed: string[];
  embroideryType: string | null;
  stitchCount: number | null;
  sizeLabel: string | null;
  machineFormat: string | null;
  projectNotes: string | null;
  mediaAltTexts: Record<string, string>;
}

// docs/portfolio-spec.md §10.1/§10.3 — reuses the real Services module taxonomy (apps/api/scripts/
// seed-services.ts) rather than inventing a separate category vocabulary, so Portfolio categories
// stay consistent with what a customer also sees on /services. `category` on PortfolioItemDto
// remains a plain string (no FK) — this is the controlled vocabulary the admin Select offers.
export const PORTFOLIO_CATEGORIES = [
  'Logo Digitizing',
  'Cap & Hat Digitizing',
  '3D Puff Digitizing',
  'Left Chest Digitizing',
  'Jacket Back Digitizing',
  'Patch & Badge Digitizing',
  'Appliqué Digitizing',
  'Image-to-Embroidery',
  'Monogram & Lettering',
  'Vector Art',
] as const;

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];
