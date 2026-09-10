// docs/specs/2026-08-29-18-mobile-app-android-ios.md §6 (Unit row): "push-token registration/
// de-registration idempotency" — apps/mobile/push/*.spec.ts. Exercises lib/push-registration.ts
// against mocked expo-notifications + apiFetch, since the real Notifications permission API and
// Expo push token issuance only exist on-device.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-token]' })),
}));

const mockApiFetch = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../lib/api-client', () => ({ apiFetch: (path: string, init?: RequestInit) => mockApiFetch(path, init) }));

import * as Notifications from 'expo-notifications';
import { deregisterPushToken, registerPushToken } from '../lib/push-registration';

describe('push-registration (A-023 §6 unit row)', () => {
  beforeEach(() => {
    mockApiFetch.mockClear();
  });

  it('registers the Expo push token via POST /api/users/push-token', async () => {
    await registerPushToken('access-token-1');
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/users/push-token',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('ExponentPushToken[test-token]') }),
    );
  });

  it('registering twice in a row is idempotent from the client\'s perspective — always sends the same upsert payload, never accumulates local state', async () => {
    await registerPushToken('access-token-1');
    await registerPushToken('access-token-1');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = mockApiFetch.mock.calls as [string, RequestInit][];
    expect(firstCall[1]?.body).toBe(secondCall[1]?.body);
  });

  it('does not register when the user declines the push permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    await registerPushToken('access-token-1');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('deregisters via DELETE /api/users/push-token/:token on logout', async () => {
    await deregisterPushToken('access-token-1');
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/users/push-token/ExponentPushToken%5Btest-token%5D',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('never throws even if the API call fails (best-effort, must not block login/logout)', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network down'));
    await expect(registerPushToken('access-token-1')).resolves.toBeUndefined();
  });
});
