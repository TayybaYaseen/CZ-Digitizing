// docs/specs/2026-08-29-18-mobile-app-android-ios.md AC-6 — architecture §Performance &
// Optimization "Mobile App Performance" -> Network: "Retry logic: Exponential backoff (3
// attempts)". Exercises api-client.ts's fetchWithRetry wrapper directly through apiFetch, since
// it has no separate export (kept private on purpose — every caller goes through apiFetch).
jest.mock('./storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  deleteItem: jest.fn(async () => undefined),
}));

import { apiFetch } from './api-client';

function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => text,
    json: async () => body,
    clone() {
      return jsonResponse(status, body);
    },
  } as unknown as Response;
}

describe('api-client network retry (AC-6 performance budget)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries a GET on network failure with exponential backoff and resolves once it recovers', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));

    const promise = apiFetch('/api/designs');
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 attempts when the network never recovers', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const promise = apiFetch('/api/designs');
    const assertion = expect(promise).rejects.toThrow('Network request failed');
    await jest.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a GET on a transient 5xx and returns the eventual success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'down' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));

    const promise = apiFetch('/api/designs');
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a mutating request on a 5xx, to avoid duplicating a side effect that already reached the server', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom' } }));

    await expect(apiFetch('/api/orders', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 4xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'missing' } }));

    await expect(apiFetch('/api/designs/missing')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
