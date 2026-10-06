import type {
  AdminSupportConversationSummaryDto,
  AdminSupportMessageDto,
  SupportContextRefDto,
  SupportConversationDto,
  SupportConversationSummaryDto,
  SupportMessageDto,
} from '@czd/shared-types';
import type { Prisma, SupportMessage } from '../../generated/prisma';

// Everything a list row / detail header needs, in one query (no per-row lookups — spec §31).
export const SUPPORT_CONVERSATION_INCLUDE = {
  customer: { select: { id: true, email: true, displayName: true, username: true } },
  customRequest: { select: { requestNumber: true } },
} satisfies Prisma.SupportConversationInclude;

export type SupportConversationRow = Prisma.SupportConversationGetPayload<{ include: typeof SUPPORT_CONVERSATION_INCLUDE }>;

export const SUPPORT_MESSAGE_INCLUDE = {
  sender: { select: { id: true, displayName: true, username: true, email: true } },
} satisfies Prisma.SupportMessageInclude;

export type SupportMessageRow = Prisma.SupportMessageGetPayload<{ include: typeof SUPPORT_MESSAGE_INCLUDE }>;

export function toContextRef(row: SupportConversationRow): SupportContextRefDto {
  switch (row.contextType) {
    case 'order':
      return { type: 'order', id: row.orderId?.toString() ?? null, label: row.orderId?.toString() ?? null };
    case 'custom_request':
      return { type: 'custom_request', id: row.customRequestId?.toString() ?? null, label: row.customRequest?.requestNumber ?? null };
    case 'quote':
      return { type: 'quote', id: row.quoteId?.toString() ?? null, label: row.quoteId?.toString() ?? null };
    case 'file_format_request':
      return { type: 'file_format_request', id: row.fileFormatRequestId?.toString() ?? null, label: row.fileFormatRequestId?.toString() ?? null };
    default:
      return { type: 'general', id: null, label: null };
  }
}

// ---- Customer-facing (spec §28.3: no admin identities, no open-vs-pending, no Admin read pointer) ----

export function toCustomerSummaryDto(row: SupportConversationRow): SupportConversationSummaryDto {
  return {
    id: row.id.toString(),
    context: toContextRef(row),
    isResolved: row.status === 'resolved',
    lastMessagePreview: row.lastMessagePreview,
    lastMessageFromMe: row.lastMessageSenderType === 'customer',
    lastMessageAt: row.lastMessageAt.toISOString(),
    unreadCount: row.customerUnreadCount,
  };
}

export function toCustomerConversationDto(row: SupportConversationRow): SupportConversationDto {
  return {
    ...toCustomerSummaryDto(row),
    createdAt: row.createdAt.toISOString(),
    supportLastReadMessageId: row.adminLastReadMessageId?.toString() ?? null,
  };
}

export function toCustomerMessageDto(message: SupportMessage): SupportMessageDto {
  if (message.senderType === 'system') {
    // Callers filter system lines out in the query; reaching here would be a data-minimization bug.
    throw new Error('System support messages are never exposed to customers');
  }
  return {
    id: message.id.toString(),
    conversationId: message.conversationId.toString(),
    senderType: message.senderType,
    body: message.body,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
  };
}

// ---- Admin-facing ----

export function displayNameOf(user: { displayName: string | null; username: string | null; email?: string | null }): string | null {
  return user.displayName || user.username || null;
}

export function toAdminSummaryDto(row: SupportConversationRow): AdminSupportConversationSummaryDto {
  return {
    id: row.id.toString(),
    status: row.status,
    customer: { id: row.customer.id.toString(), displayName: displayNameOf(row.customer), email: row.customer.email },
    context: toContextRef(row),
    lastMessagePreview: row.lastMessagePreview,
    lastMessageSenderType: row.lastMessageSenderType === 'system' ? null : row.lastMessageSenderType,
    lastMessageAt: row.lastMessageAt.toISOString(),
    unreadCount: row.adminUnreadCount,
  };
}

export function toAdminMessageDto(message: SupportMessageRow): AdminSupportMessageDto {
  return {
    id: message.id.toString(),
    conversationId: message.conversationId.toString(),
    senderType: message.senderType,
    sender: message.sender ? { id: message.sender.id.toString(), displayName: displayNameOf(message.sender) ?? message.sender.email } : null,
    body: message.body,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
  };
}
