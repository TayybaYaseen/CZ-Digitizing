import type { NotificationDto } from '@czd/shared-types';

// Where clicking a row in the customer notification center takes you — the web counterpart of
// apps/mobile/lib/notification-deep-link.ts. Returns null for types with no dedicated page
// (e.g. taebo_answered); those rows just mark themselves read and stay on the list.
export function getNotificationHref(n: Pick<NotificationDto, 'notificationType'> & Partial<Pick<NotificationDto, 'relatedSupportConversationId'>>): string | null {
  switch (n.notificationType) {
    case 'order_confirmed':
    case 'payment_received':
    case 'files_ready':
    case 'order_status_change':
    case 'receipt_uploaded':
      return '/account/orders';
    case 'file_format_available':
      return '/account/purchased-designs';
    case 'quote_submitted':
    case 'quote_response':
      return '/account/quotes';
    case 'custom_request_status_update':
      return '/account/custom-requests';
    case 'subscription_renewal':
    case 'subscription_renewal_failed':
    case 'subscription_logo_limit_low':
      return '/account/subscription';
    case 'credit_purchase':
      return '/account/credits';
    case 'new_device_login':
      return '/account/activity';
    // A-025 — opens the conversation the reply belongs to.
    case 'support_reply':
      return n.relatedSupportConversationId ? `/account/support/${n.relatedSupportConversationId}` : '/account/support';
    default:
      return null;
  }
}
