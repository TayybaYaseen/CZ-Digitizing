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
}
