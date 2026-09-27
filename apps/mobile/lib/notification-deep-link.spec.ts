// docs/specs/2026-08-28-02-notifications-system.md AC-7 — the tap-to-screen mapping is pure and
// tested in isolation from react-navigation/expo-notifications (see use-notification-tap-handler.ts
// for the side-effecting wiring, which needs the app running on-device to exercise for real).
import { getNotificationDeepLinkTarget } from './notification-deep-link';

describe('getNotificationDeepLinkTarget (AC-7)', () => {
  it.each([
    ['order_confirmed', 'Orders'],
    ['payment_received', 'Orders'],
    ['files_ready', 'Orders'],
    ['order_status_change', 'Orders'],
    ['receipt_uploaded', 'Orders'],
    ['file_format_available', 'Orders'],
    ['subscription_renewal', 'Subscription'],
    ['subscription_renewal_failed', 'Subscription'],
    ['subscription_logo_limit_low', 'Subscription'],
    ['credit_purchase', 'Credits'],
  ] as const)('routes %s to %s', (notificationType, expectedScreen) => {
    expect(getNotificationDeepLinkTarget({ notificationType })).toEqual({ screen: expectedScreen });
  });

  it('routes custom_request_status_update with a related id to the detail screen', () => {
    expect(getNotificationDeepLinkTarget({ notificationType: 'custom_request_status_update', relatedCustomRequestId: '9' })).toEqual({
      screen: 'CustomRequestDetail',
      params: { requestId: '9' },
    });
  });

  it('falls back to the CustomRequests list when the related id is missing', () => {
    expect(getNotificationDeepLinkTarget({ notificationType: 'custom_request_status_update' })).toEqual({ screen: 'CustomRequests' });
  });

  it('falls back to the notification list for types with no dedicated screen (e.g. quote_response, taebo_answered)', () => {
    expect(getNotificationDeepLinkTarget({ notificationType: 'quote_response' })).toEqual({ screen: 'Notifications' });
    expect(getNotificationDeepLinkTarget({ notificationType: 'taebo_answered' })).toEqual({ screen: 'Notifications' });
  });

  it('never throws on missing or malformed data — falls back to the notification list', () => {
    expect(getNotificationDeepLinkTarget(undefined)).toEqual({ screen: 'Notifications' });
    expect(getNotificationDeepLinkTarget(null)).toEqual({ screen: 'Notifications' });
    expect(getNotificationDeepLinkTarget({ notificationType: 'something_unrecognized' })).toEqual({ screen: 'Notifications' });
  });
});
