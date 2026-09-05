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
// docs/specs/2026-08-28-13-home-promotions-cms.md (aspect A-018, A-018a-c).
describe('Home Promotions CMS (docs/specs/2026-08-28-13-home-promotions-cms.md)', () => {
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
    await prisma.homeSectionDesign.deleteMany();
    await prisma.homeSection.deleteMany();
    await prisma.advertisementTargetDesign.deleteMany();
    await prisma.advertisement.deleteMany();
    await prisma.headerMedia.deleteMany();
    await prisma.design.deleteMany({ where: { name: { contains: 'Home CMS Test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@home-cms-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@home-cms-test.example.com`, role: 'admin' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  async function createDesign(name: string) {
    return prisma.design.create({ data: { name, previewImageUrl: 'https://example.com/p.png', pricePkr: 1000, isPublished: true } });
  }

  it('AC-1/AC-2/AC-7: a Home Section with designs publishes, reorders, and reflects immediately', async () => {
    const admin = await createAdmin();
    const design = await createDesign('Home CMS Test Design');

    const created = await request(app.getHttpServer())
      .post('/api/admin/home/sections')
      .set(authHeader(admin))
      .send({ heading: 'Best Sellers', designIds: [design.id.toString()], isPublished: false })
      .expect(201);

    expect((await request(app.getHttpServer()).get('/api/home/sections')).body.data).toHaveLength(0);

    await request(app.getHttpServer()).put(`/api/admin/home/sections/${created.body.data.id}`).set(authHeader(admin)).send({ isPublished: true }).expect(200);

    const list = await request(app.getHttpServer()).get('/api/home/sections').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].designs.map((d: { id: string }) => d.id)).toContain(design.id.toString());
  });

  it('AC-2: multiple sections render in Admin-defined order', async () => {
    const admin = await createAdmin();
    const design = await createDesign('Home CMS Test Design 2');
    const a = await request(app.getHttpServer()).post('/api/admin/home/sections').set(authHeader(admin)).send({ heading: 'A', designIds: [design.id.toString()], isPublished: true, sortOrder: 1 }).expect(201);
    const b = await request(app.getHttpServer()).post('/api/admin/home/sections').set(authHeader(admin)).send({ heading: 'B', designIds: [design.id.toString()], isPublished: true, sortOrder: 0 }).expect(201);

    const list = await request(app.getHttpServer()).get('/api/home/sections').expect(200);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([b.body.data.id, a.body.data.id]);

    await request(app.getHttpServer())
      .put('/api/admin/home/sections/reorder')
      .set(authHeader(admin))
      .send({ items: [{ id: a.body.data.id, sortOrder: 0 }, { id: b.body.data.id, sortOrder: 1 }] })
      .expect(204);

    const reordered = await request(app.getHttpServer()).get('/api/home/sections').expect(200);
    expect(reordered.body.data.map((s: { id: string }) => s.id)).toEqual([a.body.data.id, b.body.data.id]);
  });

  it('AC-5: no active advertisement -> the ad area is skipped (null response)', async () => {
    const res = await request(app.getHttpServer()).get('/api/home/advertisement').expect(200);
    expect(res.body.data).toBeNull();
  });

  it('AC-3/AC-4: an advertisement within its date window is active; past endDate it disappears', async () => {
    const admin = await createAdmin();
    const now = Date.now();

    const active = await request(app.getHttpServer())
      .post('/api/admin/advertisements')
      .set(authHeader(admin))
      .send({
        heading: 'Summer Sale',
        startDate: new Date(now - 1000 * 60 * 60).toISOString(),
        endDate: new Date(now + 1000 * 60 * 60 * 24).toISOString(),
        isActive: true,
      })
      .expect(201);

    const res = await request(app.getHttpServer()).get('/api/home/advertisement').expect(200);
    expect(res.body.data.id).toBe(active.body.data.id);

    await request(app.getHttpServer())
      .put(`/api/admin/advertisements/${active.body.data.id}`)
      .set(authHeader(admin))
      .send({ endDate: new Date(now - 1000).toISOString() })
      .expect(200);

    const afterExpiry = await request(app.getHttpServer()).get('/api/home/advertisement').expect(200);
    expect(afterExpiry.body.data).toBeNull();
  });

  it('rejects an advertisement targeting both a category and specific designs', async () => {
    const admin = await createAdmin();
    const design = await createDesign('Home CMS Test Design 3');
    const category = await prisma.designCategory.create({ data: { name: 'Home CMS Test Category', slug: `home-cms-test-${Date.now()}` } });

    await request(app.getHttpServer())
      .post('/api/admin/advertisements')
      .set(authHeader(admin))
      .send({
        heading: 'Conflict',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 1000 * 60).toISOString(),
        targetCategoryId: category.id.toString(),
        targetDesignIds: [design.id.toString()],
      })
      .expect(422);

    await prisma.designCategory.delete({ where: { id: category.id } });
  });

  it('AC-6/AC-10: header media is filtered by active window and per-platform visibility', async () => {
    const admin = await createAdmin();
    const now = Date.now();

    const desktopOnly = await request(app.getHttpServer())
      .post('/api/admin/header-media')
      .set(authHeader(admin))
      .send({ heading: 'Desktop banner', isActive: true, visibleMobileWeb: false, startDate: new Date(now - 1000).toISOString(), endDate: new Date(now + 100000).toISOString() })
      .expect(201);

    const desktopList = await request(app.getHttpServer()).get('/api/home/header-media').query({ platform: 'desktop' }).expect(200);
    expect(desktopList.body.data.map((h: { id: string }) => h.id)).toContain(desktopOnly.body.data.id);

    const mobileList = await request(app.getHttpServer()).get('/api/home/header-media').query({ platform: 'mobile_web' }).expect(200);
    expect(mobileList.body.data.map((h: { id: string }) => h.id)).not.toContain(desktopOnly.body.data.id);
  });
});
