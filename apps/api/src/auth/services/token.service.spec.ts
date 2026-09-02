import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import type { Env } from '../../config/env.validation';

function buildConfig(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values: Partial<Env> = {
    JWT_ACCESS_SECRET: 'access-secret-at-least-32-characters-long',
    JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters-long',
    ...overrides,
  };
  return { get: (key: keyof Env) => values[key] } as ConfigService<Env, true>;
}

describe('TokenService', () => {
  const service = new TokenService(new JwtService({}), buildConfig());

  it('round-trips an access token with the fixed JWT claim shape', () => {
    const token = service.signAccessToken({
      userId: 42n,
      email: 'customer@example.com',
      role: 'customer',
      deviceId: 'device-1',
      permissions: [],
    });
    const payload = service.verifyAccessToken(token);
    expect(payload).toMatchObject({
      sub: '42',
      email: 'customer@example.com',
      role: 'customer',
      device_id: 'device-1',
      permissions: [],
    });
  });

  it('round-trips a refresh token carrying session_id, not device_id', () => {
    const token = service.signRefreshToken({ userId: 7n, sessionId: 'session-abc' });
    const payload = service.verifyRefreshToken(token);
    expect(payload).toMatchObject({ sub: '7', session_id: 'session-abc' });
  });

  it('rejects a refresh token when verified as an access token (distinct secrets)', () => {
    const refreshToken = service.signRefreshToken({ userId: 7n, sessionId: 'session-abc' });
    expect(() => service.verifyAccessToken(refreshToken)).toThrow();
  });

  it('rejects a tampered/invalid token', () => {
    expect(() => service.verifyAccessToken('not-a-real-token')).toThrow();
  });

  it('rejects a magic-link token presented as a pending-2FA token (purpose mismatch)', () => {
    const magicLink = service.signMagicLinkToken({ userId: 1n, email: 'user@example.com', deviceId: 'device-1' });
    expect(() => service.verifyPendingTwoFactorToken(magicLink)).toThrow();
  });
});
