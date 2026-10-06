import type { SupportMessage } from '../../generated/prisma';
import { toAdminSummaryDto, toContextRef, toCustomerConversationDto, toCustomerMessageDto, type SupportConversationRow } from './support-chat.mapper';

function row(overrides: Partial<SupportConversationRow> = {}): SupportConversationRow {
  const now = new Date('2026-10-06T10:00:00Z');
  return {
    id: 7n,
    customerId: 3n,
    status: 'pending',
    contextType: 'general',
    orderId: null,
    customRequestId: null,
    quoteId: null,
    fileFormatRequestId: null,
    lastMessageAt: now,
    lastMessagePreview: 'hi',
    lastMessageSenderType: 'admin',
    customerLastReadMessageId: 10n,
    customerLastReadAt: now,
    adminLastReadMessageId: 11n,
    adminLastReadAt: now,
    customerUnreadCount: 2,
    adminUnreadCount: 5,
    statusChangedAt: now,
    statusChangedByAdminId: 99n,
    createdAt: now,
    updatedAt: now,
    customer: { id: 3n, email: 'c@example.com', displayName: null, username: 'cust' },
    customRequest: null,
    ...overrides,
  };
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §28.3 — customer DTOs never expose Admin-only data.
describe('support chat mapper', () => {
  it('customer DTO hides open-vs-pending, admin identities and the status actor', () => {
    const dto = toCustomerConversationDto(row());
    expect(dto).toEqual({
      id: '7',
      context: { type: 'general', id: null, label: null },
      isResolved: false,
      lastMessagePreview: 'hi',
      lastMessageFromMe: false,
      lastMessageAt: '2026-10-06T10:00:00.000Z',
      unreadCount: 2,
      createdAt: '2026-10-06T10:00:00.000Z',
      supportLastReadMessageId: '11',
    });
    expect(JSON.stringify(dto)).not.toMatch(/pending|99|adminUnread|statusChanged/);
  });

  it('customer unread uses the customer counter; admin unread uses the admin counter', () => {
    expect(toCustomerConversationDto(row()).unreadCount).toBe(2);
    expect(toAdminSummaryDto(row()).unreadCount).toBe(5);
    expect(toAdminSummaryDto(row()).status).toBe('pending');
    expect(toAdminSummaryDto(row()).customer.displayName).toBe('cust');
  });

  it('labels contexts by their display number, and keeps the type after the record was deleted', () => {
    expect(toContextRef(row({ contextType: 'order', orderId: 1234n }))).toEqual({ type: 'order', id: '1234', label: '1234' });
    expect(toContextRef(row({ contextType: 'custom_request', customRequestId: 5n, customRequest: { requestNumber: 'CR-2026-0005' } }))).toEqual({
      type: 'custom_request',
      id: '5',
      label: 'CR-2026-0005',
    });
    expect(toContextRef(row({ contextType: 'order', orderId: null }))).toEqual({ type: 'order', id: null, label: null });
  });

  it('refuses to map a system line for a customer', () => {
    const system = { id: 1n, conversationId: 7n, senderType: 'system', senderUserId: 99n, body: 'Status changed', clientMessageId: 'x', createdAt: new Date() } as SupportMessage;
    expect(() => toCustomerMessageDto(system)).toThrow();
  });

  it('customer message DTO carries no sender user id', () => {
    const message = { id: 1n, conversationId: 7n, senderType: 'admin', senderUserId: 99n, body: 'Hello', clientMessageId: 'abc', createdAt: new Date('2026-10-06T10:00:00Z') } as SupportMessage;
    const dto = toCustomerMessageDto(message);
    expect(dto).toEqual({ id: '1', conversationId: '7', senderType: 'admin', body: 'Hello', clientMessageId: 'abc', createdAt: '2026-10-06T10:00:00.000Z' });
  });
});
