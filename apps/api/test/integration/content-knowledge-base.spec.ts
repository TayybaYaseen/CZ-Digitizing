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
// docs/specs/2026-08-28-10-content-knowledge-base.md (aspect A-012, A-012a-f).
describe('Content & Knowledge Base (docs/specs/2026-08-28-10-content-knowledge-base.md)', () => {
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
    await prisma.tipFaqLink.deleteMany();
    await prisma.faq.deleteMany();
    await prisma.embroidererTip.deleteMany();
    await prisma.testimonial.deleteMany();
    await prisma.blogPost.deleteMany();
    await prisma.portfolioItem.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '@content-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@content-test.example.com`, role: 'admin' } });
  }

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@content-test.example.com`, role: 'customer' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-1/AC-2/AC-6: FAQ publish/unpublish propagates immediately to the public list and search', async () => {
    const admin = await createAdmin();

    const created = await request(app.getHttpServer())
      .post('/api/faqs')
      .set(authHeader(admin))
      .send({ question: 'What formats do you support?', answer: 'DST, PES, and more.', topic: 'formats', languageCode: 'en', taeboVisible: true })
      .expect(201);

    expect((await request(app.getHttpServer()).get('/api/faqs').query({ topic: 'formats' })).body.data).toHaveLength(0); // unpublished

    await request(app.getHttpServer()).put(`/api/faqs/${created.body.data.id}`).set(authHeader(admin)).send({ isPublished: true }).expect(200);

    const list = await request(app.getHttpServer()).get('/api/faqs').query({ topic: 'formats', language_code: 'en' }).expect(200);
    expect(list.body.data.map((f: { id: string }) => f.id)).toContain(created.body.data.id);

    const search = await request(app.getHttpServer()).get('/api/faqs/search').query({ q: 'formats' }).expect(200);
    expect(search.body.data.map((f: { id: string }) => f.id)).toContain(created.body.data.id);

    await request(app.getHttpServer()).put(`/api/faqs/${created.body.data.id}`).set(authHeader(admin)).send({ isPublished: false }).expect(200);
    const afterUnpublish = await request(app.getHttpServer()).get('/api/faqs').query({ topic: 'formats' }).expect(200);
    expect(afterUnpublish.body.data.map((f: { id: string }) => f.id)).not.toContain(created.body.data.id);
  });

  it('AC-8: "Was this helpful?" aggregates yes/no counts against the FAQ entry', async () => {
    const faq = await prisma.faq.create({ data: { question: 'q', answer: 'a', topic: 't', isPublished: true } });

    await request(app.getHttpServer()).post(`/api/faqs/${faq.id}/feedback`).send({ vote: 'yes' }).expect(204);
    await request(app.getHttpServer()).post(`/api/faqs/${faq.id}/feedback`).send({ vote: 'no' }).expect(204);
    await request(app.getHttpServer()).post(`/api/faqs/${faq.id}/feedback`).send({ vote: 'yes' }).expect(204);

    const updated = await prisma.faq.findUniqueOrThrow({ where: { id: faq.id } });
    expect(updated.helpfulYesCount).toBe(2);
    expect(updated.helpfulNoCount).toBe(1);
  });

  it('AC-3: a Tip can be linked to an FAQ and found via linkedFaqId', async () => {
    const admin = await createAdmin();
    const faq = await prisma.faq.create({ data: { question: 'q', answer: 'a', topic: 't', isPublished: true } });

    const tip = await request(app.getHttpServer())
      .post('/api/tips')
      .set(authHeader(admin))
      .send({ title: 'Stabilizer basics', content: 'Use a tear-away stabilizer.', category: 'basics', isPublished: true, faqIds: [faq.id.toString()] })
      .expect(201);

    const list = await request(app.getHttpServer()).get('/api/tips').query({ linkedFaqId: faq.id.toString() }).expect(200);
    expect(list.body.data.map((t: { id: string }) => t.id)).toContain(tip.body.data.id);
  });

  it('AC-7: a customer review requires a completed order and starts pending/unpublished; Admin approval publishes it', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const order = await prisma.order.create({
      data: { customerId: customer.id, status: 'completed', paymentMethod: 'bank_transfer', totalPkr: 1000 },
    });

    const submitted = await request(app.getHttpServer())
      .post('/api/testimonials/submit')
      .set(authHeader(customer))
      .send({ orderId: order.id.toString(), rating: 5, feedback: 'Excellent work!', serviceUsed: 'Embroidery Digitizing' })
      .expect(201);

    expect(submitted.body.data.isPublished).toBe(false);
    expect(submitted.body.data.moderationStatus).toBe('pending');
    expect((await request(app.getHttpServer()).get('/api/testimonials')).body.data).toHaveLength(0);

    await request(app.getHttpServer()).put(`/api/testimonials/${submitted.body.data.id}/moderate`).set(authHeader(admin)).send({ decision: 'approved' }).expect(200);

    const publicList = await request(app.getHttpServer()).get('/api/testimonials').expect(200);
    expect(publicList.body.data.map((t: { id: string }) => t.id)).toContain(submitted.body.data.id);
  });

  it('AC-7: rejects a review for an order that is not completed', async () => {
    const customer = await createCustomer();
    const order = await prisma.order.create({ data: { customerId: customer.id, status: 'processing', paymentMethod: 'bank_transfer', totalPkr: 1000 } });

    await request(app.getHttpServer())
      .post('/api/testimonials/submit')
      .set(authHeader(customer))
      .send({ orderId: order.id.toString(), rating: 5, feedback: 'x', serviceUsed: 'y' })
      .expect(409);
  });

  it('AC-9/AC-15/AC-16: Blog create -> edit reflects -> hard delete removes it', async () => {
    const admin = await createAdmin();

    const created = await request(app.getHttpServer())
      .post('/api/blog')
      .set(authHeader(admin))
      .send({ title: 'Thread care tips', slug: 'thread-care-tips', body: 'Keep thread dry.', category: 'care', isPublished: true })
      .expect(201);

    const listed = await request(app.getHttpServer()).get('/api/blog').query({ category: 'care' }).expect(200);
    expect(listed.body.data.map((p: { slug: string }) => p.slug)).toContain('thread-care-tips');

    await request(app.getHttpServer()).put(`/api/blog/${created.body.data.id}`).set(authHeader(admin)).send({ title: 'Thread care tips (updated)' }).expect(200);
    const detail = await request(app.getHttpServer()).get('/api/blog/thread-care-tips').expect(200);
    expect(detail.body.data.title).toBe('Thread care tips (updated)');

    await request(app.getHttpServer()).delete(`/api/blog/${created.body.data.id}`).set(authHeader(admin)).expect(204);
    await request(app.getHttpServer()).get('/api/blog/thread-care-tips').expect(404);
  });

  it('AC-11: About content saves are immediately live with no publish step', async () => {
    const admin = await createAdmin();

    await request(app.getHttpServer())
      .put('/api/admin/about')
      .set(authHeader(admin))
      .send({ languageCode: 'fr', heading: 'À propos', body: 'Notre histoire.' })
      .expect(200);

    const publicView = await request(app.getHttpServer()).get('/api/about').query({ language_code: 'fr' }).expect(200);
    expect(publicView.body.data.heading).toBe('À propos');
  });

  it('AC-12/AC-13: Portfolio items list in Admin-defined order and reorder reflects immediately', async () => {
    const admin = await createAdmin();
    const a = await prisma.portfolioItem.create({ data: { title: 'A', mediaUrls: ['https://example.com/a.png'], isPublished: true, sortOrder: 0 } });
    const b = await prisma.portfolioItem.create({ data: { title: 'B', mediaUrls: ['https://example.com/b.png'], isPublished: true, sortOrder: 1 } });

    const before = await request(app.getHttpServer()).get('/api/portfolio').expect(200);
    expect(before.body.data.map((i: { id: string }) => i.id)).toEqual([a.id.toString(), b.id.toString()]);

    await request(app.getHttpServer())
      .put('/api/portfolio/reorder')
      .set(authHeader(admin))
      .send({ items: [{ id: a.id.toString(), sortOrder: 1 }, { id: b.id.toString(), sortOrder: 0 }] })
      .expect(204);

    const after = await request(app.getHttpServer()).get('/api/portfolio').expect(200);
    expect(after.body.data.map((i: { id: string }) => i.id)).toEqual([b.id.toString(), a.id.toString()]);
  });
});
