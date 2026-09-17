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

export interface TestimonialDto {
  id: string;
  customerName: string;
  country: string;
  business: string | null;
  photoUrl: string | null;
  rating: number;
  feedback: string;
  serviceUsed: string;
  isPublished: boolean;
  source: TestimonialSource;
  moderationStatus: TestimonialModeration;
  orderId: string | null;
  createdAt: string;
}

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
