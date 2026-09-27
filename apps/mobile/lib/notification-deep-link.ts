import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AccountStackParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigation-ref';

// Mirrors the `data` shape NotificationPushService (apps/api) attaches to the Expo push message —
// see apps/api/src/notifications/services/notification-push.service.ts.
export interface NotificationDeepLinkData {
  notificationId?: string;
  notificationType?: string;
  relatedOrderId?: string;
  relatedQuoteId?: string;
  relatedCustomRequestId?: string;
}

export type NotificationDeepLinkTarget = NavigatorScreenParams<AccountStackParamList>;

// docs/specs/2026-08-28-02-notifications-system.md AC-7 — maps a tapped push notification's data
// payload to the most specific existing Account-stack screen available. Several notification types
// (quote_submitted/quote_response, taebo_answered, new_device_login, admin-only types) have no
// dedicated per-item screen on mobile today — those, and any unrecognized/malformed payload, land
// on the notification list itself (always exists, always shows the triggering notification) rather
// than crashing or silently doing nothing. Pure/no side effects — kept separate from
// navigateToNotificationTarget() below so the mapping itself is unit-testable without mocking
// react-navigation.
export function getNotificationDeepLinkTarget(data: NotificationDeepLinkData | null | undefined): NotificationDeepLinkTarget {
  switch (data?.notificationType) {
    case 'order_confirmed':
    case 'payment_received':
    case 'files_ready':
    case 'order_status_change':
    case 'receipt_uploaded':
    case 'file_format_available':
      return { screen: 'Orders' };
    case 'custom_request_status_update':
      return data.relatedCustomRequestId
        ? { screen: 'CustomRequestDetail', params: { requestId: data.relatedCustomRequestId } }
        : { screen: 'CustomRequests' };
    case 'subscription_renewal':
    case 'subscription_renewal_failed':
    case 'subscription_logo_limit_low':
      return { screen: 'Subscription' };
    case 'credit_purchase':
      return { screen: 'Credits' };
    default:
      return { screen: 'Notifications' };
  }
}

// Never throws: a malformed payload, or a tap arriving before the nav tree is ready (e.g. the user
// is still on the auth stack), must not crash the app — it's simply a no-op in that case, the same
// best-effort posture apps/mobile/lib/push-registration.ts already takes on the send side.
export function navigateToNotificationTarget(data: NotificationDeepLinkData | null | undefined): void {
  if (!navigationRef.isReady()) return;
  try {
    navigationRef.navigate('AccountTab', getNotificationDeepLinkTarget(data));
  } catch {
    // swallow — see doc comment above.
  }
}
