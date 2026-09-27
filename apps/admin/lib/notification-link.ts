import type { NotificationDto } from '@czd/shared-types';

// Where clicking a row in the Admin notification center takes you. Types with no business page
// of their own (admin_alert, system_alert, new_device_login, …) open the notification's own
// detail view, so every row leads somewhere.
export function getNotificationHref(n: Pick<NotificationDto, 'id' | 'notificationType' | 'relatedOrderId' | 'relatedContactMessageId'>): string {
  switch (n.notificationType) {
    case 'order_confirmed':
    case 'payment_received':
    case 'files_ready':
    case 'order_status_change':
    case 'receipt_uploaded':
      return n.relatedOrderId ? `/orders/${n.relatedOrderId}` : '/orders';
    case 'quote_submitted':
    case 'quote_response':
      return '/quotes';
    case 'custom_request_status_update':
      return '/custom-requests';
    case 'file_format_available':
      return '/file-format-requests';
    case 'new_registration':
      return '/customers';
    case 'taebo_waiting':
    case 'taebo_answered':
      return '/taebo/unanswered';
    case 'credit_purchase':
      return '/credits';
    case 'subscription_renewal':
    case 'subscription_renewal_failed':
    case 'subscription_logo_limit_low':
      return '/customers';
    case 'contact_message':
      return n.relatedContactMessageId ? `/contact-messages/${n.relatedContactMessageId}` : '/contact-messages';
    default:
      return `/notifications/${n.id}`;
  }
}
