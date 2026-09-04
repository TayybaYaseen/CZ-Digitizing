// docs/specs/2026-08-28-02-notifications-system.md (aspect A-004) — platform-wide default
// channel-routing table, per CZ_DIGITIZING_ARCHITECTURE.md § Notifications System's Admin/Customer
// trigger tables. Used to validate a notify() caller's requested `channels` are a subset of what
// the type is allowed to route to (NotificationPreferenceService layers per-user opt-outs on top —
// never an expansion beyond this table, see notification-preference.service.ts).
import { NotificationChannel, NotificationType } from '../generated/prisma';

// 'push' is deliberately on every customer-facing type, not called out per-type in the
// architecture's Admin/Customer trigger tables the way email/whatsapp/in_app are — the
// architecture describes it separately as a cross-cutting mobile-app channel ("Notification
// Delivery" § Push: FCM + APNs, "opt-in/opt-out per user"), the same way in_app applies
// universally. 'sms' is listed only on the 3 SMS-eligible types (AC-10) so a customer can opt it
// in/out per AC-9, but NotificationService never includes it in a normal notify() dispatch — it's
// added only as a last-resort fallback when both email and WhatsApp end up unreachable (see
// notification.service.ts). Admin triggers get Dashboard/email only, per architecture's own
// Admin Notifications table — no WhatsApp/push/SMS on that side.
export const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  // Customer triggers (architecture "Customer Notifications")
  order_confirmed: ['email', 'whatsapp', 'in_app', 'push', 'sms'],
  payment_received: ['email', 'whatsapp', 'in_app', 'push', 'sms'],
  files_ready: ['email', 'whatsapp', 'in_app', 'push', 'sms'],
  quote_submitted: ['email', 'in_app', 'push'],
  quote_response: ['email', 'whatsapp', 'in_app', 'push'],
  custom_request_status_update: ['email', 'whatsapp', 'in_app', 'push'],
  file_format_available: ['email', 'whatsapp', 'in_app', 'push'],
  subscription_renewal: ['email', 'in_app', 'push'],
  subscription_renewal_failed: ['email', 'in_app', 'push'],
  subscription_logo_limit_low: ['email', 'in_app', 'push'],
  credit_purchase: ['email', 'in_app', 'push'],
  new_device_login: ['email', 'in_app', 'push'],
  taebo_answered: ['email', 'in_app', 'push'],
  order_status_change: ['email', 'in_app', 'push'],
  // Admin triggers (architecture "Admin Notifications") — Dashboard/email only, no WhatsApp/push/SMS.
  new_registration: ['email', 'in_app'],
  taebo_waiting: ['email', 'in_app'],
  contact_message: ['email', 'in_app'],
  receipt_uploaded: ['email', 'in_app'],
  admin_alert: ['in_app'],
  system_alert: ['in_app'],
};

// AC-3 — 30-day in-app retention for customer-facing notifications. Admin-only types (no
// customer-visible equivalent) get expiresAt = null — AC-2 states no equivalent cap for those.
export const CUSTOMER_RETENTION_DAYS = 30;

export const ADMIN_ONLY_TYPES: readonly NotificationType[] = [
  'new_registration',
  'taebo_waiting',
  'contact_message',
  'receipt_uploaded',
  'admin_alert',
  'system_alert',
];

// AC-6 — WhatsApp is skipped in favor of email/in-app once the customer's last inbound message
// is older than this (or they've never messaged in).
export const WHATSAPP_FALLBACK_WINDOW_HOURS = 48;

// AC-10 — SMS fires only once both WhatsApp and email are established unreachable, never blanket.
export const SMS_ELIGIBLE_TYPES: readonly NotificationType[] = ['order_confirmed', 'payment_received', 'files_ready'];
