// Mirrors docs/specs/2026-08-28-11-smart-get-a-quote.md §3/§4 (aspect A-016).
// Shared between apps/api, apps/web, apps/admin.

export interface QuoteQuestionDto {
  id: string;
  question: string;
  answer: string;
  serviceId: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QuoteStatus = 'draft' | 'new' | 'responded' | 'converted_to_order';
export type QuoteMessageSender = 'customer' | 'admin';

export interface QuoteMessageDto {
  id: string;
  quoteId: string;
  senderRole: QuoteMessageSender;
  body: string;
  createdAt: string;
}

export interface QuoteDto {
  id: string;
  customerId: string | null;
  name: string;
  email: string;
  whatsapp: string | null;
  country: string | null;
  serviceId: string;
  designUploadPath: string | null;
  size: string | null;
  quantity: number | null;
  fabric: string | null;
  threadColors: string | null;
  formatPreference: string | null;
  deadline: string | null;
  instructions: string | null;
  status: QuoteStatus;
  // Only ever included in the response to the request that created/owns the draft — never on
  // admin-facing or authenticated-history reads (see QuotesService.toQuoteDto()'s call sites).
  accessToken?: string;
  suggestedPricePkr: string | null;
  quotedPricePkr: string | null;
  adminNotes: string | null;
  respondedAt: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}
