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
// docs/specs/2026-08-29-17-services-module.md (aspect A-014, A-014a, A-014b).
describe('Services Module (docs/specs/2026-08-29-17-services-module.md)', () => {
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
    await prisma.service.deleteMany({ where: { slug: { contains: '-svc-test' } } });
    await prisma.faq.deleteMany({ where: { topic: 'services-test' } });
    await prisma.designCategory.deleteMany({ where: { slug: { contains: '-svc-test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@services-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@services-test.example.com`, role: 'admin' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-1/AC-8: Admin creates a main service and a sub-service; publish propagates to the public list', async () => {
    const admin = await createAdmin();

    const main = await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Test Main Svc',
        slug: 'test-main-svc-svc-test',
        type: 'embroidery_digitizing',
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
        isPublished: true,
      })
      .expect(201);

    const sub = await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Test Sub Svc',
        slug: 'test-sub-svc-svc-test',
        type: 'embroidery_digitizing',
        parentServiceId: main.body.data.id,
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
        isPublished: true,
      })
      .expect(201);

    const list = await request(app.getHttpServer()).get('/api/services').expect(200);
    const found = list.body.data.find((s: { id: string }) => s.id === main.body.data.id);
    expect(found).toBeDefined();
    expect(found.subServices.map((s: { id: string }) => s.id)).toContain(sub.body.data.id);
  });

  it('AC-2/AC-6: rejects a sub-service whose type differs from its parent, and resolves related FAQs by slug/name match', async () => {
    const admin = await createAdmin();
    const main = await prisma.service.create({
      data: {
        name: 'Vector Test',
        slug: 'vector-test-svc-test',
        type: 'vector_art',
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
        isPublished: true,
      },
    });

    await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Mismatched Sub',
        slug: 'mismatched-sub-svc-test',
        type: 'embroidery_digitizing',
        parentServiceId: main.id.toString(),
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
      })
      .expect(400);

    await prisma.faq.create({ data: { question: 'q', answer: 'a', topic: 'services-test', relatedService: main.slug, isPublished: true } });

    const detail = await request(app.getHttpServer()).get(`/api/services/${main.slug}`).expect(200);
    expect(detail.body.data.relatedFaqIds).toHaveLength(1);
  });

  it('AC-10: a service can link to a Design Catalog category via relatedDesignCategoryId', async () => {
    const admin = await createAdmin();
    const category = await prisma.designCategory.create({ data: { name: 'Cap Embroidery', slug: 'cap-embroidery-svc-test', isPublished: true } });

    const created = await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Cap & Hat Test',
        slug: 'cap-hat-svc-test',
        type: 'embroidery_digitizing',
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
        relatedDesignCategoryId: category.id.toString(),
        isPublished: true,
      })
      .expect(201);

    const detail = await request(app.getHttpServer()).get(`/api/services/cap-hat-svc-test`).expect(200);
    expect(detail.body.data.relatedDesignCategoryId).toBe(category.id.toString());
    expect(detail.body.data.id).toBe(created.body.data.id);
  });

  it('AC-8: reorder immediately reflects in the public list order', async () => {
    const admin = await createAdmin();
    const a = await prisma.service.create({
      data: { name: 'A Svc Test', slug: 'a-svc-test', type: 'embroidery_digitizing', description: 'd', visualImageUrl: '/i.jpg', applications: 'a', process: 'p', isPublished: true, sortOrder: 0 },
    });
    const b = await prisma.service.create({
      data: { name: 'B Svc Test', slug: 'b-svc-test', type: 'embroidery_digitizing', description: 'd', visualImageUrl: '/i.jpg', applications: 'a', process: 'p', isPublished: true, sortOrder: 1 },
    });

    await request(app.getHttpServer()).put(`/api/services/${a.id}/reorder`).set(authHeader(admin)).send({ sortOrder: 2 }).expect(200);

    const list = await request(app.getHttpServer()).get('/api/services').expect(200);
    const ids = list.body.data.map((s: { id: string }) => s.id);
    expect(ids.indexOf(b.id.toString())).toBeLessThan(ids.indexOf(a.id.toString()));
  });

  it('unpublished service is 404 for a public caller but visible to admin', async () => {
    const admin = await createAdmin();
    const hidden = await prisma.service.create({
      data: { name: 'Hidden Svc Test', slug: 'hidden-svc-test', type: 'embroidery_digitizing', description: 'd', visualImageUrl: '/i.jpg', applications: 'a', process: 'p', isPublished: false },
    });

    await request(app.getHttpServer()).get(`/api/services/${hidden.slug}`).expect(404);
    await request(app.getHttpServer()).get(`/api/services/${hidden.slug}`).set(authHeader(admin)).expect(200);
  });
});
