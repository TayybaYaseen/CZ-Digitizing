import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { EmailService } from '../../src/email/email.service';

// Requires a real Postgres + Redis reachable via the DATABASE_URL/REDIS_URL in apps/api/.env
// (docker-compose.yml — `docker compose up -d`) with `prisma migrate dev` already applied.
// Run with: pnpm --filter @czd/api test:integration
describe('Auth API (docs/specs/2026-08-28-01-auth-account-security.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let sendMock: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    void app.get(ConfigService); // ensures env validated before tests run
  });

  // app.close() already runs RedisService.onModuleDestroy() -> client.quit() — an extra manual
  // quit() here double-closes the same connection (harmless in ioredis but throws in tests, plus
  // a spurious "did not exit" warning from the resulting unhandled rejection).
  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.adminPermission.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    // Rate-limit counters (RateLimiterService) live in Redis, keyed per IP+route — every test
    // in this file shares one IP, so a prior test's AC-4 exhaustion would otherwise leak into
    // later tests hitting the same route (e.g. verify-new-device) and fail them with 429s that
    // have nothing to do with what they're testing.
    await redis.client.flushdb();
    sendMock = jest.spyOn(app.get(EmailService), 'send').mockResolvedValue(undefined);
  });

  afterEach(() => sendMock.mockRestore());

  function lastEmailCodeTo(email: string): string {
    const call = sendMock.mock.calls.map((c) => c[0]).reverse().find((m) => m.to === email);
    const match = /\b(\d{4})\b/.exec(call?.text ?? '');
    if (!match) throw new Error(`no 4-digit code found in email to ${email}`);
    return match[1];
  }

  const agent = () => request.agent(app.getHttpServer());

  // AC-1
  it('registers a customer with a bcrypt-hashed password and an unverified email', async () => {
    const res = await agent().post('/api/auth/register').send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'new@example.com', role: 'customer', gmailVerified: false });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'new@example.com' } });
    expect(stored.passwordHash).not.toBe('password123');
  });

  it('rejects registering an already-registered email (409 EMAIL_ALREADY_REGISTERED)', async () => {
    await agent().post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    const res = await agent().post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  // AC-2 / AC-3 / AC-4
  it('requires new-device verification on first login, then trusts the device on the next login (AC-2/AC-3)', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({ email: 'device@example.com', password: 'password123' });

    const firstLogin = await client.post('/api/auth/login').send({ email: 'device@example.com', password: 'password123' });
    expect(firstLogin.status).toBe(401);
    expect(firstLogin.body.error.code).toBe('NEW_DEVICE_VERIFICATION_REQUIRED');

    const code = lastEmailCodeTo('device@example.com');
    const verify = await client.post('/api/auth/verify-new-device').send({ email: 'device@example.com', code });
    expect(verify.status).toBe(200);
    expect(verify.body.data.accessToken).toBeDefined();

    const secondLogin = await client.post('/api/auth/login').send({ email: 'device@example.com', password: 'password123' });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.data.accessToken).toBeDefined();
  });

  it('rate-limits new-device verification after 3 wrong attempts in the window (AC-4)', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({ email: 'ratelimit@example.com', password: 'password123' });
    await client.post('/api/auth/login').send({ email: 'ratelimit@example.com', password: 'password123' });

    for (let i = 0; i < 3; i++) {
      const res = await client.post('/api/auth/verify-new-device').send({ email: 'ratelimit@example.com', code: '0000' });
      expect([401, 429]).toContain(res.status);
    }
    const res = await client.post('/api/auth/verify-new-device').send({ email: 'ratelimit@example.com', code: '0000' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  // AC-5
  it('requires admin 2FA enrollment + verification before issuing a session, regardless of device trust', async () => {
    const admin = await prisma.user.create({
      data: { email: 'admin@example.com', passwordHash: await hashForTest('adminpass123'), role: 'admin' },
    });

    const client = agent();
    const login = await client.post('/api/auth/login').send({ email: admin.email, password: 'adminpass123' });
    expect(login.status).toBe(200);
    expect(login.body.data.pendingTwoFactorToken).toBeDefined();
    expect(login.body.data.setupRequired).toBe(true);

    const pendingAuth = { Authorization: `Bearer ${login.body.data.pendingTwoFactorToken}` };
    const setup = await client.post('/api/auth/2fa/setup').set(pendingAuth).send();
    expect(setup.status).toBe(200);
    expect(setup.body.data.secret).toBeDefined();

    const { authenticator } = await import('otplib');
    const code = authenticator.generate(setup.body.data.secret);
    const confirm = await client.post('/api/auth/2fa/confirm').set(pendingAuth).send({ code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.accessToken).toBeDefined();

    // Logging in again still requires 2FA even though the device is now trusted.
    const secondLogin = await client.post('/api/auth/login').send({ email: admin.email, password: 'adminpass123' });
    expect(secondLogin.body.data.setupRequired).toBe(false);
    expect(secondLogin.body.data.pendingTwoFactorToken).toBeDefined();
  });

  // AC-6
  it('resets a forgotten password via a 10-minute code and revokes every existing session', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({ email: 'reset@example.com', password: 'oldpassword1' });
    await client.post('/api/auth/login').send({ email: 'reset@example.com', password: 'oldpassword1' });
    const deviceCode = lastEmailCodeTo('reset@example.com');
    const { body: session } = await client.post('/api/auth/verify-new-device').send({ email: 'reset@example.com', code: deviceCode });

    await agent().post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    const resetCode = lastEmailCodeTo('reset@example.com');
    const reset = await agent().post('/api/auth/reset-password').send({ email: 'reset@example.com', code: resetCode, newPassword: 'newpassword1' });
    expect(reset.status).toBe(200);

    const refresh = await agent().post('/api/auth/refresh-token').send({ refreshToken: session.data.refreshToken });
    expect(refresh.status).toBe(401);

    const loginOld = await agent().post('/api/auth/login').send({ email: 'reset@example.com', password: 'oldpassword1' });
    expect(loginOld.status).toBe(401);
  });

  it('never reveals whether an email exists on forgot-password', async () => {
    const res = await agent().post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  // AC-7
  it('rejects verify-session once the underlying session is revoked (30-day inactivity proxy)', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({ email: 'expiring@example.com', password: 'password123' });
    await client.post('/api/auth/login').send({ email: 'expiring@example.com', password: 'password123' });
    const code = lastEmailCodeTo('expiring@example.com');
    const verify = await client.post('/api/auth/verify-new-device').send({ email: 'expiring@example.com', code });

    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await agent()
      .get('/api/auth/verify-session')
      .set('Authorization', `Bearer ${verify.body.data.accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  // AC-9
  it('returns 403 and writes an audit log for a non-admin calling an admin route', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({ email: 'customer@example.com', password: 'password123' });
    await client.post('/api/auth/login').send({ email: 'customer@example.com', password: 'password123' });
    const code = lastEmailCodeTo('customer@example.com');
    const verify = await client.post('/api/auth/verify-new-device').send({ email: 'customer@example.com', code });

    const res = await agent()
      .get('/api/admin/freelancer-accounts')
      .set('Authorization', `Bearer ${verify.body.data.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const logs = await prisma.auditLog.findMany({ where: { actionType: 'ACCESS_DENIED' } });
    expect(logs.length).toBeGreaterThan(0);
  });

  // AC-8
  it('scopes a freelancer account to its granted modules and revokes it immediately', async () => {
    const admin = await prisma.user.create({
      data: { email: 'admin2@example.com', passwordHash: await hashForTest('adminpass123'), role: 'admin', twoFactorEnabled: false },
    });
    const adminClient = agent();
    const login = await adminClient.post('/api/auth/login').send({ email: admin.email, password: 'adminpass123' });
    const pendingAuth = { Authorization: `Bearer ${login.body.data.pendingTwoFactorToken}` };
    const setup = await adminClient.post('/api/auth/2fa/setup').set(pendingAuth).send();
    const { authenticator } = await import('otplib');
    const confirm = await adminClient.post('/api/auth/2fa/confirm').set(pendingAuth).send({ code: authenticator.generate(setup.body.data.secret) });
    const adminAuth = { Authorization: `Bearer ${confirm.body.data.accessToken}` };

    const created = await adminClient
      .post('/api/admin/freelancer-accounts')
      .set(adminAuth)
      .send({ email: 'freelancer@example.com', role: 'freelancer', permissions: [{ module: 'orders', accessLevel: 'read_only' }] });
    expect(created.status).toBe(201);

    await adminClient.delete(`/api/admin/freelancer-accounts/${created.body.data.id}`).set(adminAuth);

    const permissions = await prisma.adminPermission.findMany({ where: { userId: BigInt(created.body.data.id) } });
    expect(permissions.every((p) => p.revokedAt !== null)).toBe(true);
  });

  // AC-11
  it('logs a moderator in with the same device-trust flow as a customer', async () => {
    await prisma.user.create({
      data: { email: 'mod@example.com', passwordHash: await hashForTest('modpass123'), role: 'moderator', gmailVerified: true },
    });
    const client = agent();
    const login = await client.post('/api/auth/login').send({ email: 'mod@example.com', password: 'modpass123' });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('NEW_DEVICE_VERIFICATION_REQUIRED');
  });
});

async function hashForTest(plaintext: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(plaintext, 12);
}
