import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with `prisma migrate dev`
// already applied. Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-06-design-bundles.md — CRUD, membership add/remove, and AC-5's
// unpublish-hides-from-public-list behavior. AC-2/AC-3's order-linkage and AC-4's
// "existing purchasers keep access" can't be meaningfully integration-tested without an `orders`
// table (A-013, still Blocked per docs/specs/SPEC_INDEX.md) — deferred to A-013's own suite, not
// fabricated here. The equivalent membership-removal-doesn't-retroactively-revoke logic is covered
// at the unit level in bundles.service.spec.ts.
describe('Design Bundles (docs/specs/2026-08-28-06-design-bundles.md)', () => {
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
    await app.close();
  });

  beforeEach(async () => {
    await prisma.bundleDesign.deleteMany();
    await prisma.designBundle.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { role: 'admin' } });
  });

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@example.com`, role: 'admin' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  const agent = () => request(app.getHttpServer());

  it('AC-1: admin creates a bundle and it appears on the public Bundles list once published', async () => {
    const admin = await createAdmin();

    const createRes = await agent()
      .post('/api/bundles')
      .set(authHeader(admin))
      .send({ name: '10 Cap Logos Bundle', pricePkr: 4000, isPublished: true })
      .expect(201);

    const bundleId = createRes.body.data.id as string;

    const listRes = await agent().get('/api/bundles').expect(200);
    expect(listRes.body.data.find((b: { id: string }) => b.id === bundleId)).toBeDefined();
  });

  it('AC-1: admin adds designs to a bundle and the detail DTO lists includedDesigns', async () => {
    const admin = await createAdmin();
    const design1 = await prisma.design.create({ data: { name: 'Cap Logo 1', previewImageUrl: 'https://example.com/1.png', pricePkr: 500 } });
    const design2 = await prisma.design.create({ data: { name: 'Cap Logo 2', previewImageUrl: 'https://example.com/2.png', pricePkr: 600 } });

    const createRes = await agent().post('/api/bundles').set(authHeader(admin)).send({ name: 'Cap Bundle', pricePkr: 1000 }).expect(201);
    const bundleId = createRes.body.data.id as string;

    await agent().post(`/api/bundles/${bundleId}/designs/${design1.id}`).set(authHeader(admin)).send({}).expect(201);
    await agent().post(`/api/bundles/${bundleId}/designs/${design2.id}`).set(authHeader(admin)).send({}).expect(201);

    const detailRes = await agent().get(`/api/bundles/${bundleId}`).set(authHeader(admin)).expect(200);
    expect(detailRes.body.data.includedDesigns).toHaveLength(2);
  });

  it('AC-7: a per-design price override is reflected in that design entry within the bundle detail', async () => {
    const admin = await createAdmin();
    const design = await prisma.design.create({ data: { name: 'Overridden Design', previewImageUrl: 'https://example.com/1.png', pricePkr: 500 } });
    const createRes = await agent().post('/api/bundles').set(authHeader(admin)).send({ name: 'Override Bundle', pricePkr: 1000 }).expect(201);
    const bundleId = createRes.body.data.id as string;

    await agent().post(`/api/bundles/${bundleId}/designs/${design.id}`).set(authHeader(admin)).send({ priceOverridePkr: 300 }).expect(201);

    const detailRes = await agent().get(`/api/bundles/${bundleId}`).set(authHeader(admin)).expect(200);
    expect(detailRes.body.data.includedDesigns[0].priceOverridePkr).toBe(300);
  });

  it('AC-4: removing a design from a bundle updates current membership without erroring, and the bundle keeps existing', async () => {
    const admin = await createAdmin();
    const design = await prisma.design.create({ data: { name: 'Removable Design', previewImageUrl: 'https://example.com/1.png', pricePkr: 500 } });
    const createRes = await agent().post('/api/bundles').set(authHeader(admin)).send({ name: 'Removal Bundle', pricePkr: 1000 }).expect(201);
    const bundleId = createRes.body.data.id as string;

    await agent().post(`/api/bundles/${bundleId}/designs/${design.id}`).set(authHeader(admin)).send({}).expect(201);
    await agent().delete(`/api/bundles/${bundleId}/designs/${design.id}`).set(authHeader(admin)).expect(204);

    const detailRes = await agent().get(`/api/bundles/${bundleId}`).set(authHeader(admin)).expect(200);
    expect(detailRes.body.data.includedDesigns).toHaveLength(0);
  });

  it('AC-5: unpublishing a bundle removes it from the public list but admin can still see and load it', async () => {
    const admin = await createAdmin();
    const createRes = await agent().post('/api/bundles').set(authHeader(admin)).send({ name: 'Soon Unpublished', pricePkr: 1000, isPublished: true }).expect(201);
    const bundleId = createRes.body.data.id as string;

    await agent().put(`/api/bundles/${bundleId}`).set(authHeader(admin)).send({ isPublished: false }).expect(200);

    const publicList = await agent().get('/api/bundles').expect(200);
    expect(publicList.body.data.find((b: { id: string }) => b.id === bundleId)).toBeUndefined();

    const publicGet = await agent().get(`/api/bundles/${bundleId}`).expect(404);
    expect(publicGet.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const adminGet = await agent().get(`/api/bundles/${bundleId}`).set(authHeader(admin)).expect(200);
    expect(adminGet.body.data.id).toBe(bundleId);
  });

  it('AC-5: deleting a bundle soft-deletes it — it disappears from both public and admin listings but the row still exists', async () => {
    const admin = await createAdmin();
    const createRes = await agent().post('/api/bundles').set(authHeader(admin)).send({ name: 'Soon Deleted', pricePkr: 1000, isPublished: true }).expect(201);
    const bundleId = createRes.body.data.id as string;

    await agent().delete(`/api/bundles/${bundleId}`).set(authHeader(admin)).expect(204);

    const adminList = await agent().get('/api/bundles').set(authHeader(admin)).expect(200);
    expect(adminList.body.data.find((b: { id: string }) => b.id === bundleId)).toBeUndefined();

    const row = await prisma.designBundle.findUnique({ where: { id: BigInt(bundleId) } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();
  });

  it('a non-admin cannot create a bundle', async () => {
    const customer = await prisma.user.create({ data: { email: `customer-${Date.now()}@example.com`, role: 'customer' } });
    await agent().post('/api/bundles').set(authHeader(customer)).send({ name: 'Should Fail', pricePkr: 1000 }).expect(403);
  });
});
