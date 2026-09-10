import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api-client';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3 (aspect A-023) — register the Expo push
// token via POST /api/users/push-token on login success + app foreground; deregister via DELETE
// on logout. Uses Expo's own device token (not raw FCM/APNs tokens) since apps/api's
// NotificationPushService sends through Expo's push API.
export async function registerPushToken(accessToken: string): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return; // customer declined — not an error, just no push this session

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    if (platform !== 'ios' && platform !== 'android') return;

    await apiFetch('/api/users/push-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token: tokenResponse.data, platform }),
    });
  } catch {
    // Push registration is best-effort — never blocks login/foreground on a push failure.
  }
}

export async function deregisterPushToken(accessToken: string): Promise<void> {
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    await apiFetch(`/api/users/push-token/${encodeURIComponent(tokenResponse.data)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Best-effort on logout too — the server-side token simply goes stale if this fails.
  }
}
