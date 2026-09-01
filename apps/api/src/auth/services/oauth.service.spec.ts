import type { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import type { Env } from '../../config/env.validation';

function buildConfig(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values: Partial<Env> = { API_BASE_URL: 'https://api.test.local', ...overrides };
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

function mockFetchSequence(...responses: { ok?: boolean; json: unknown }[]) {
  const fn = jest.fn();
  for (const response of responses) {
    fn.mockImplementationOnce(async () => ({ ok: response.ok ?? true, json: async () => response.json }));
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('OAuthService (AC-10)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects building an authorization URL for an unconfigured provider (501)', () => {
    const service = new OAuthService(buildConfig());
    expect(() => service.buildAuthorizationUrl('google', 'state123')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('builds a Google authorization URL with the callback redirect_uri and state', () => {
    const service = new OAuthService(buildConfig({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' }));
    const url = new URL(service.buildAuthorizationUrl('google', 'state123'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('gid');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.test.local/api/auth/oauth/google/callback');
    expect(url.searchParams.get('state')).toBe('state123');
  });

  it('exchanges a Google code for a verified profile', async () => {
    const service = new OAuthService(buildConfig({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' }));
    mockFetchSequence(
      { json: { access_token: 'token-1' } },
      { json: { email: 'user@example.com', email_verified: true, name: 'User' } },
    );
    await expect(service.exchangeCodeForProfile('google', 'code-1')).resolves.toEqual({
      email: 'user@example.com',
      emailVerified: true,
      displayName: 'User',
    });
  });

  it('exchanges a Facebook code for a profile (email presence implies verification)', async () => {
    const service = new OAuthService(buildConfig({ FACEBOOK_CLIENT_ID: 'fid', FACEBOOK_CLIENT_SECRET: 'fsecret' }));
    mockFetchSequence(
      { json: { access_token: 'token-1' } },
      { json: { email: 'fb@example.com', name: 'FB User' } },
    );
    await expect(service.exchangeCodeForProfile('facebook', 'code-1')).resolves.toEqual({
      email: 'fb@example.com',
      emailVerified: true,
      displayName: 'FB User',
    });
  });

  it('rejects a Facebook profile with no email (account never verified one)', async () => {
    const service = new OAuthService(buildConfig({ FACEBOOK_CLIENT_ID: 'fid', FACEBOOK_CLIENT_SECRET: 'fsecret' }));
    mockFetchSequence({ json: { access_token: 'token-1' } }, { json: { name: 'No Email' } });
    await expect(service.exchangeCodeForProfile('facebook', 'code-1')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects when the provider token exchange itself fails', async () => {
    const service = new OAuthService(buildConfig({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' }));
    mockFetchSequence({ ok: false, json: { error: 'invalid_grant' } });
    await expect(service.exchangeCodeForProfile('google', 'bad-code')).rejects.toMatchObject({ status: 401 });
  });
});
