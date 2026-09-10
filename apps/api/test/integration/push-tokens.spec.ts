import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { User } from '../../src/generated/prisma';
import { NotificationPushService } from '../../src/notifications/services/notification-push.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

// Requires a real Postgres + Redis reachable via the DATABASE_URL/REDIS_URL in apps/api/.env,
// with `prisma migrate dev` already applied. Run with: pnpm --filter @czd/api test:integration
// (this file only, per this repo's established one-file-at-a-time isolation practice).
//
// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3/§4/§6 (aspect A-023):
// - POST/DELETE /api/users/push-token round trip + own-token-only guard
// - NotificationPushService successfully targeting a registered token via a mocked Expo transport
describe('Push Tokens API (docs/specs/2026-08-29-18-mobile-app-android-ios.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let tokens: TokenService;
  let pushService: NotificationPushService;
  let sendMock: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    tokens = app.get(TokenService);
    pushService = app.get(NotificationPushService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.pushToken.deleteMany();
    await prisma.notificationDeliveryLog.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.adminPermission.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await redis.client.flushdb();
    // Fake Expo transport — no real network call to Expo's push service in tests.
    // NotificationPushService.send() calls Expo's HTTP push endpoint via the global `fetch`, so
    // mocking `fetch` is this suite's fake transport (see that service's doc comment for why it
    // isn't the `expo-server-sdk` npm package: ESM-only, incompatible with this repo's CJS Jest).
    sendMock = jest.spyOn(global, 'fetch').mockImplementation(
      async () =>
        ({
          ok: true,
          json: async () => ({ data: [{ status: 'ok', id: `ticket-${Math.random()}` }] }),
        }) as Response,
    );
  });

  afterEach(() => sendMock.mockRestore());

  async function createUser(overrides: Partial<User> = {}): Promise<User> {
    return prisma.user.create({ data: { email: `user-${Date.now()}-${Math.random()}@example.com`, role: 'customer', ...overrides } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  const agent = () => request(app.getHttpServer());
  // Real Expo-format token so Expo.isExpoPushToken() accepts it.
  const validToken = () => `ExponentPushToken[${Math.random().toString(36).slice(2)}]`;

  it('registers a push token, is idempotent on re-registration, and lists it under the user', async () => {
    const customer = await createUser();
    const token = validToken();

    const first = await agent().post('/api/users/push-token').set(authHeader(customer)).send({ token, platform: 'ios' });
    expect(first.status).toBe(201);
    expect(first.body.data.token).toBe(token);

    const second = await agent().post('/api/users/push-token').set(authHeader(customer)).send({ token, platform: 'ios' });
    expect(second.status).toBe(201);

    const rows = await prisma.pushToken.findMany({ where: { userId: customer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe('ios');
  });

  it('deletes a token on request (204) and is idempotent-safe: deleting someone else\'s token is forbidden', async () => {
    const owner = await createUser();
    const other = await createUser();
    const token = validToken();
    await agent().post('/api/users/push-token').set(authHeader(owner)).send({ token, platform: 'android' });

    const forbidden = await agent().delete(`/api/users/push-token/${encodeURIComponent(token)}`).set(authHeader(other));
    expect(forbidden.status).toBe(403);
    expect(await prisma.pushToken.findUnique({ where: { token } })).not.toBeNull();

    const ok = await agent().delete(`/api/users/push-token/${encodeURIComponent(token)}`).set(authHeader(owner));
    expect(ok.status).toBe(204);
    expect(await prisma.pushToken.findUnique({ where: { token } })).toBeNull();
  });

  it('deleting a token that does not exist returns 404', async () => {
    const customer = await createUser();
    const res = await agent().delete(`/api/users/push-token/${encodeURIComponent(validToken())}`).set(authHeader(customer));
    expect(res.status).toBe(404);
  });

  it('NotificationPushService successfully sends to a registered token via the (mocked) Expo transport', async () => {
    const customer = await createUser();
    const token = validToken();
    await agent().post('/api/users/push-token').set(authHeader(customer)).send({ token, platform: 'ios' });

    const result = await pushService.send({ userId: customer.id, title: 'Files ready', message: 'Download them now' });
    expect(result).toBeTruthy();
    expect(sendMock).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ body: expect.stringContaining(token) }));
    const sentBody = JSON.parse(sendMock.mock.calls[0][1].body as string);
    expect(sentBody).toEqual(expect.arrayContaining([expect.objectContaining({ to: token, title: 'Files ready', body: 'Download them now' })]));
  });

  it('NotificationPushService no-ops for a user with no registered device (never throws)', async () => {
    const customer = await createUser();
    await expect(pushService.send({ userId: customer.id, title: 'x', message: null })).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
