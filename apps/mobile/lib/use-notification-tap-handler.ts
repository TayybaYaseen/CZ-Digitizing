import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { navigateToNotificationTarget } from './notification-deep-link';

// docs/specs/2026-08-28-02-notifications-system.md AC-7 — deep-links a tapped push notification to
// the relevant in-app screen. Covers both a live tap (app foregrounded/backgrounded,
// addNotificationResponseReceivedListener) and a cold start (app was killed, opened directly from
// the notification tray, getLastNotificationResponseAsync) — see Expo's own docs on why both are
// needed: the listener alone misses the launch-time case.
export function useNotificationTapHandler(): void {
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) navigateToNotificationTarget(response.notification.request.content.data);
      })
      .catch(() => {
        // Best-effort, same posture as push-registration.ts.
      });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToNotificationTarget(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);
}
