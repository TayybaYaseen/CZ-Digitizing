// Mirrors docs/specs/2026-08-28-02-notifications-system.md §2-4 and
// CZ_DIGITIZING_ARCHITECTURE.md § Notifications System. Values consolidated across every spec
// that names a trigger (auth-account-security, orders-payment-processing, smart-get-a-quote,
// custom-design-requests, taebo-chatbot, subscriptions-credits) — extend here, never per-feature.

export type NotificationType =
  | 'order_confirmed'
  | 'payment_received'
  | 'files_ready'
  | 'quote_submitted'
  | 'quote_response'
  | 'custom_request_status_update'
  | 'file_format_available'
  | 'subscription_renewal'
  | 'subscription_renewal_failed'
  | 'subscription_logo_limit_low'
  | 'credit_purchase'
  | 'new_registration'
  | 'new_device_login'
  | 'taebo_waiting'
  | 'taebo_answered'
  | 'contact_message'
  | 'receipt_uploaded'
  | 'admin_alert'
  | 'system_alert'
  | 'order_status_change';

export type NotificationChannel = 'email' | 'whatsapp' | 'in_app' | 'push' | 'sms';

export interface NotificationDto {
  id: string;
  notificationType: NotificationType;
  title: string;
  message: string | null;
  relatedOrderId: string | null;
  relatedQuoteId: string | null;
  relatedCustomRequestId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}
