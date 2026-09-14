import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module';
import { TokenService } from '../apps/api/src/auth/services/token.service';
import type { User } from '../apps/api/src/generated/prisma';
import { PrismaService } from '../apps/api/src/prisma/prisma.service';

// docs/specs/2026-08-29-17-services-module.md §6's e2e row: "browse Services -> open a
// sub-category -> see visuals/applications/process/FAQs -> click Get a Quote -> Step 1
// pre-selected." Like this repo's only other e2e/*.e2e.spec.ts
// (cross-platform-sync.e2e.spec.ts), this is an API-level walk of that full flow rather than a
// browser-driven one — no Playwright/browser-automation runner is wired into this repo's own test
// scripts, so this exercises the exact same sequence of calls the customer-facing pages
// (apps/web/app/services/**, apps/web/components/ServiceDetail.tsx,
// apps/web/app/get-a-quote/page.tsx) make, end to end against a real running API/Postgres, rather
// than re-testing individual endpoints in isolation the way
// apps/api/test/integration/services.spec.ts already does.
//
// Run with: pnpm exec jest --config e2e/jest.config.js (repo root, requires a real Postgres
// reachable via apps/api/.env, migrations applied).
describe('Services Module end-to-end flow (docs/specs/2026-08-29-17-services-module.md AC-1..AC-11)', () => {
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
    await prisma.quote.deleteMany({ where: { service: { slug: { contains: '-svc-e2e' } } } });
    await prisma.service.deleteMany({ where: { slug: { contains: '-svc-e2e' } } });
    await prisma.faq.deleteMany({ where: { topic: 'services-e2e-test' } });
    await prisma.designCategory.deleteMany({ where: { slug: { contains: '-svc-e2e' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@services-e2e-test.example.com' } } });
  }

  beforeEach(cleanUp);

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('customer browses Services, opens a sub-category, sees its content, and Get a Quote pre-selects it', async () => {
    const admin = await prisma.user.create({ data: { email: `admin-${Date.now()}@services-e2e-test.example.com`, role: 'admin' } });
    const category = await prisma.designCategory.create({ data: { name: 'Cap Embroidery E2E', slug: `cap-embroidery-svc-e2e-${Date.now()}`, isPublished: true } });

    // Admin sets up a main service and one sub-category (AC-1/AC-2/AC-8), linked to a Design
    // Catalog category (AC-10) and with a matching FAQ (AC-6) already published.
    const main = await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Embroidery Digitizing E2E',
        slug: `embroidery-digitizing-svc-e2e-${Date.now()}`,
        type: 'embroidery_digitizing',
        description: 'Turns your artwork into a production-ready stitch file.',
        visualImageUrl: '/images/services/embroidery-digitizing.jpg',
        applications: 'Apparel branding, uniforms, promotional merchandise.',
        process: 'Submit artwork, we digitize, you approve a proof, you receive final files.',
        isPublished: true,
      })
      .expect(201);
    const mainId = main.body.data.id;

    const sub = await request(app.getHttpServer())
      .post('/api/services')
      .set(authHeader(admin))
      .send({
        name: 'Cap & Hat Digitizing E2E',
        slug: `cap-hat-digitizing-svc-e2e-${Date.now()}`,
        type: 'embroidery_digitizing',
        parentServiceId: mainId,
        description: 'Digitizing optimized for the curved surface of caps and hats.',
        visualImageUrl: '/images/services/cap-hat-digitizing.jpg',
        applications: 'Baseball caps, beanies, trucker hats.',
        process: 'Submit your logo, we digitize for the cap hoop, you approve, you receive files.',
        relatedDesignCategoryId: category.id.toString(),
        isPublished: true,
      })
      .expect(201);
    const subSlug = sub.body.data.slug;
    const subId = sub.body.data.id;

    await prisma.faq.create({ data: { question: 'Do you digitize caps?', answer: 'Yes.', topic: 'services-e2e-test', relatedService: subSlug, isPublished: true } });

    // --- "browse Services" (AC-1): the main service shows up in the public list with its sub. ---
    const list = await request(app.getHttpServer()).get('/api/services').expect(200);
    const foundMain = list.body.data.find((s: { id: string }) => s.id === mainId);
    expect(foundMain).toBeTruthy();
    expect(foundMain.subServices.some((s: { id: string }) => s.id === subId)).toBe(true);

    // --- "open a sub-category -> see visuals/applications/process/FAQs" (AC-2/AC-4/AC-5/AC-6). ---
    const detail = await request(app.getHttpServer()).get(`/api/services/${subSlug}`).expect(200);
    expect(detail.body.data.visualImageUrl).toBe('/images/services/cap-hat-digitizing.jpg');
    expect(detail.body.data.applications).toContain('Baseball caps');
    expect(detail.body.data.process).toContain('digitize for the cap hoop');
    expect(detail.body.data.relatedFaqIds).toHaveLength(1);
    // AC-10 — the "browse pre-made designs instead" link resolves to a real Design Catalog category.
    expect(detail.body.data.relatedDesignCategoryId).toBe(category.id.toString());

    // --- "click Get a Quote -> Step 1 pre-selected" (AC-7/AC-9/AC-11) ---------------------------
    // Mirrors apps/web/app/get-a-quote/page.tsx reading `?service=<slug>`, resolving it against the
    // services list fetched above, then POSTing the draft with that service's id — proving AC-9's
    // shared service identity (a real FK, not just a matching name) resolves correctly end to end,
    // and that Services itself never computed a price or created the quote (AC-11: this call goes
    // straight to the Smart Get a Quote spec's own endpoint, nothing in the services module is
    // involved in creating or pricing it).
    const draft = await request(app.getHttpServer()).post('/api/quotes/draft').send({ serviceId: subId }).expect(201);
    expect(draft.body.data.serviceId).toBe(subId);
    expect(draft.body.data.status).toBe('draft');
    expect(draft.body.data.suggestedPricePkr ?? null).toBeNull();
    expect(draft.body.data.quotedPricePkr ?? null).toBeNull();
  });
});
