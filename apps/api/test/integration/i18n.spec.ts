import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with migrations applied.
// Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-16-internationalization.md (aspect A-021).
describe('Internationalization (docs/specs/2026-08-28-16-internationalization.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  async function cleanUp() {
    await prisma.uiTranslation.deleteMany({ where: { locale: 'i18n-test' } });
    await prisma.language.deleteMany({ where: { code: 'i18n-test' } });
    await prisma.user.deleteMany({ where: { email: { contains: '@i18n-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@i18n-test.example.com`, role: 'admin' } });
  }

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@i18n-test.example.com`, role: 'customer' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-6: an admin can add a new language via a plain data write, no deploy needed', async () => {
    const admin = await createAdmin();

    await request(app.getHttpServer())
      .put('/api/admin/settings/languages/i18n-test')
      .set(authHeader(admin))
      .send({ name: 'Test Lang', nativeName: 'Test Lang', isRtl: false, isEnabled: true, sortOrder: 99 })
      .expect(200);

    const publicList = await request(app.getHttpServer()).get('/api/languages').expect(200);
    expect(publicList.body.data.map((l: { code: string }) => l.code)).toContain('i18n-test');
  });

  it('AC-1/AC-6: the public translation bundle reflects admin-written UI strings for a locale', async () => {
    const admin = await createAdmin();
    await prisma.language.create({ data: { code: 'i18n-test', name: 'Test Lang', nativeName: 'Test Lang', isRtl: false, isEnabled: true, sortOrder: 99 } });

    await request(app.getHttpServer())
      .put('/api/admin/settings/translations/i18n-test')
      .set(authHeader(admin))
      .send({ entries: { 'nav.home': 'Casa de Prueba' } })
      .expect(200);

    const bundle = await request(app.getHttpServer()).get('/api/translations/i18n-test').expect(200);
    expect(bundle.body.data['nav.home']).toEqual({ value: 'Casa de Prueba', isMachineTranslated: false });
  });

  it('AC-3: a key with no translation in the requested locale falls back to English', async () => {
    await prisma.language.create({ data: { code: 'i18n-test', name: 'Test Lang', nativeName: 'Test Lang', isRtl: false, isEnabled: true, sortOrder: 99 } });

    const bundle = await request(app.getHttpServer()).get('/api/translations/i18n-test').expect(200);
    expect(bundle.body.data['nav.home']?.value).toBe('Home');
  });

  it("AC-4: a logged-in customer's preferred_locale persists and is readable on future requests", async () => {
    const customer = await createCustomer();

    await request(app.getHttpServer())
      .put('/api/account/preferred-locale')
      .set(authHeader(customer))
      .send({ locale: 'ar' })
      .expect(200);

    const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(reloaded.preferredLocale).toBe('ar');
  });
});
