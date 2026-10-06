// Customer ↔ Admin Live Chat (aspect A-025) — docs/specs/2026-10-06-21-customer-admin-live-chat.md
// §10.3 (REST DTOs), §18 (customer info), §19 (context card), §11.5 (socket payloads).
// Customer-facing shapes never carry admin identities, system lines or Admin read pointers (§28.3).

export type SupportConversationStatus = 'open' | 'pending' | 'resolved';
export type SupportContextType = 'general' | 'order' | 'custom_request' | 'quote' | 'file_format_request';

export const SUPPORT_CONTEXT_TYPES: readonly SupportContextType[] = ['general', 'order', 'custom_request', 'quote', 'file_format_request'];
export const SUPPORT_CONVERSATION_STATUSES: readonly SupportConversationStatus[] = ['open', 'pending', 'resolved'];

// §14.1 / §28.4 — enforced identically by the API validator and the clients' composers.
export const SUPPORT_MESSAGE_MAX_LENGTH = 4000;
export const SUPPORT_PREVIEW_LENGTH = 140;

export interface SupportContextRefDto {
  type: SupportContextType;
  // null for `general`, or once the target record was deleted (ON DELETE SET NULL).
  id: string | null;
  // Display number only (e.g. "1234", or a custom request's request number); the UI composes
  // "Order #1234" through its own i18n.
  label: string | null;
}

// Customer list row.
export interface SupportConversationSummaryDto {
  id: string;
  context: SupportContextRefDto;
  // Customers never see open vs pending — those are Admin triage states (§16).
  isResolved: boolean;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  lastMessageAt: string;
  unreadCount: number;
}

export interface SupportConversationDto extends SupportConversationSummaryDto {
  createdAt: string;
  // Drives "Seen" under the customer's own messages.
  supportLastReadMessageId: string | null;
}

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'admin';
  body: string;
  clientMessageId: string;
  createdAt: string;
}

export interface StartSupportConversationRequest {
  contextType?: SupportContextType;
  contextId?: string;
  clientMessageId: string;
  body: string;
}

export interface SendSupportMessageRequest {
  clientMessageId: string;
  body: string;
}

export interface StartSupportConversationResult {
  conversation: SupportConversationDto;
  message: SupportMessageDto;
  created: boolean;
}

export interface SupportReadResult {
  unreadCount: number;
  totalUnread: number;
}

export interface SupportCustomerInfoDto {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string;
  phone: string | null;
  preferredLocale: string | null;
  memberSince: string;
  accountStatus: 'active' | 'inactive' | 'suspended';
  counts: { orders: number; customRequests: number; quotes: number; openConversations: number };
  adminProfileHref: string;
}

export interface SupportContextCardDto {
  type: Exclude<SupportContextType, 'general'>;
  id: string | null;
  label: string | null;
  status: string | null;
  paymentStatus?: string | null;
  totalPkr?: string | null;
  reference?: string | null;
  createdAt: string | null;
  adminHref: string | null;
  available: boolean;
}

export interface AdminSupportConversationSummaryDto {
  id: string;
  status: SupportConversationStatus;
  customer: { id: string; displayName: string | null; email: string };
  context: SupportContextRefDto;
  lastMessagePreview: string | null;
  lastMessageSenderType: 'customer' | 'admin' | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface AdminSupportConversationDto extends AdminSupportConversationSummaryDto {
  customerInfo: SupportCustomerInfoDto;
  contextCard: SupportContextCardDto | null;
  customerLastReadMessageId: string | null;
  statusChangedAt: string | null;
  statusChangedBy: { id: string; displayName: string | null } | null;
  createdAt: string;
}

export interface AdminSupportMessageDto {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'admin' | 'system';
  sender: { id: string; displayName: string | null } | null;
  body: string;
  clientMessageId: string;
  createdAt: string;
}

export interface AdminSupportReadResult {
  unreadCount: number;
  totalUnreadConversations: number;
}

// ---- Socket.IO namespace `/support-chat` (§11.5) ----

export const SUPPORT_CHAT_NAMESPACE = '/support-chat';

export type SupportSocketAck = { ok: true } | { ok: false; code: string };

export interface SupportJoinPayload {
  conversationId: string;
}

export interface SupportTypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export interface SupportViewingPayload {
  conversationId: string;
  visible: boolean;
}

export interface SupportReadEvent {
  conversationId: string;
  side: 'customer' | 'support';
  lastReadMessageId: string;
  readAt: string;
}

export interface SupportTypingEvent {
  conversationId: string;
  side: 'customer' | 'support';
  isTyping: boolean;
}

export interface SupportCustomerUnreadEvent {
  total: number;
}

export interface SupportStaffUnreadEvent {
  conversations: number;
}
