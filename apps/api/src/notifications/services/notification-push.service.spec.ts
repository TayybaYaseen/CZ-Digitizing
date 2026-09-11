import { NotificationPushService } from './notification-push.service';

function createFakePushTokens(tokens: { token: string; platform: 'ios' | 'android' }[]) {
  return { listTokensForUser: jest.fn(async () => tokens), pruneStale: jest.fn(async () => undefined) };
}

describe('NotificationPushService (A-023 — real Expo send)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('no-ops when the user has no registered device tokens', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const service = new NotificationPushService(createFakePushTokens([]) as never);
    const result = await service.send({ userId: 10n, title: 'Files ready', message: null });
    expect(result).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips malformed (non-Expo-format) tokens rather than sending to them', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const service = new NotificationPushService(createFakePushTokens([{ token: 'not-a-real-expo-token', platform: 'ios' }]) as never);
    const result = await service.send({ userId: 10n, title: 'Files ready', message: null });
    expect(result).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a valid Expo-format token to Expo\'s push endpoint and returns the ticket id', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    }));
    global.fetch = fetchMock as never;
    const service = new NotificationPushService(createFakePushTokens([{ token: 'ExponentPushToken[abc123]', platform: 'ios' }]) as never);
    const result = await service.send({ userId: 10n, title: 'Files ready', message: 'Download now' });
    expect(result).toBe('ticket-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('ExponentPushToken[abc123]') }),
    );
  });

  it('throws on a genuine Expo delivery error (not DeviceNotRegistered), so the caller\'s retry/backoff can handle it', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'error', message: 'Message too big', details: { error: 'MessageTooBig' } }] }),
    }));
    global.fetch = fetchMock as never;
    const service = new NotificationPushService(createFakePushTokens([{ token: 'ExponentPushToken[abc123]', platform: 'ios' }]) as never);
    await expect(service.send({ userId: 10n, title: 'x', message: null })).rejects.toThrow(/Message too big/);
  });

  it('§8 risk #1 — prunes a token on DeviceNotRegistered and no-ops rather than throwing when it was the only device', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }] }),
    }));
    global.fetch = fetchMock as never;
    const pushTokens = createFakePushTokens([{ token: 'ExponentPushToken[dead]', platform: 'ios' }]);
    const service = new NotificationPushService(pushTokens as never);
    const result = await service.send({ userId: 10n, title: 'x', message: null });
    expect(result).toBeUndefined();
    expect(pushTokens.pruneStale).toHaveBeenCalledWith('ExponentPushToken[dead]');
  });

  it('prunes a dead device but still reports success when another registered device received the push', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok', id: 'ticket-live' },
        ],
      }),
    }));
    global.fetch = fetchMock as never;
    const pushTokens = createFakePushTokens([
      { token: 'ExponentPushToken[dead]', platform: 'ios' },
      { token: 'ExponentPushToken[live]', platform: 'android' },
    ]);
    const service = new NotificationPushService(pushTokens as never);
    const result = await service.send({ userId: 10n, title: 'x', message: null });
    expect(result).toBe('ticket-live');
    expect(pushTokens.pruneStale).toHaveBeenCalledWith('ExponentPushToken[dead]');
    expect(pushTokens.pruneStale).toHaveBeenCalledTimes(1);
  });
});
