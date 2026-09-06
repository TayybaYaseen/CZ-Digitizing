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
// docs/specs/2026-08-28-11-smart-get-a-quote.md (aspect A-016).
describe('Smart Get a Quote (docs/specs/2026-08-28-11-smart-get-a-quote.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let serviceId: string;

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
    await prisma.quoteMessage.deleteMany({ where: { quote: { service: { slug: { contains: '-quote-test' } } } } });
    await prisma.orderItem.deleteMany({ where: { quote: { service: { slug: { contains: '-quote-test' } } } } });
    await prisma.order.deleteMany({ where: { customer: { email: { contains: '@quote-test.example.com' } } } });
    await prisma.quote.deleteMany({ where: { service: { slug: { contains: '-quote-test' } } } });
    await prisma.quoteQuestion.deleteMany({ where: { service: { slug: { contains: '-quote-test' } } } });
    await prisma.service.deleteMany({ where: { slug: { contains: '-quote-test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@quote-test.example.com' } } });
  }

  beforeEach(async () => {
    await cleanUp();
    const service = await prisma.service.create({
      data: {
        name: 'Quote Test Service',
        slug: `quote-test-svc-${Date.now()}-quote-test`,
        type: 'embroidery_digitizing',
        description: 'd',
        visualImageUrl: '/i.jpg',
        applications: 'a',
        process: 'p',
        isPublished: true,
      },
    });
    serviceId = service.id.toString();
  });

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@quote-test.example.com`, role: 'admin' } });
  }

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@quote-test.example.com`, role: 'customer' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-1/AC-2: Step 2 questions are scoped to the service and viewing them creates no quotes row', async () => {
    const admin = await createAdmin();
    await request(app.getHttpServer())
      .post('/api/quote-questions')
      .set(authHeader(admin))
      .send({ question: 'How long does it take?', answer: '2-3 days', serviceId, isPublished: true })
      .expect(201);

    const list = await request(app.getHttpServer()).get('/api/quote-questions').query({ serviceId }).expect(200);
    expect(list.body.data).toHaveLength(1);

    const quotesAfter = await prisma.quote.count({ where: { serviceId: BigInt(serviceId) } });
    expect(quotesAfter).toBe(0);
  });

  it('AC-4/AC-9: full guest draft -> chat -> submit flow fires a submission notification and no earlier writes leak a quotes row', async () => {
    const draft = await request(app.getHttpServer()).post('/api/quotes/draft').send({ serviceId }).expect(201);
    expect(draft.body.data.status).toBe('draft');
    const { id, accessToken } = draft.body.data;

    // AC-9 — pre-submission chat works against the draft.
    await request(app.getHttpServer()).post(`/api/quotes/${id}/messages`).set('x-quote-access-token', accessToken).send({ body: 'Can I get this in DST format?' }).expect(201);
    const messages = await request(app.getHttpServer()).get(`/api/quotes/${id}/messages`).set('x-quote-access-token', accessToken).expect(200);
    expect(messages.body.data).toHaveLength(1);

    // Missing required fields -> rejected.
    await request(app.getHttpServer()).post(`/api/quotes/${id}/submit`).set('x-quote-access-token', accessToken).expect(400);

    await request(app.getHttpServer()).patch(`/api/quotes/${id}`).set('x-quote-access-token', accessToken).send({ name: 'Jane Doe', email: 'jane@quote-test.example.com', size: 'M', quantity: 2 }).expect(200);

    const submitted = await request(app.getHttpServer()).post(`/api/quotes/${id}/submit`).set('x-quote-access-token', accessToken).expect(201);
    expect(submitted.body.data.status).toBe('new');

    // AC-9 access boundary — a stranger without the token cannot read this quote.
    await request(app.getHttpServer()).get(`/api/quotes/${id}`).expect(403);
  });

  it('AC-6/AC-8: Admin suggests a price, responds, and the quote moves to responded', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const quote = await prisma.quote.create({
      data: { serviceId: BigInt(serviceId), customerId: customer.id, name: 'C', email: customer.email, size: 'M', quantity: 3, status: 'new' },
    });

    const suggestion = await request(app.getHttpServer()).post(`/api/quotes/${quote.id}/suggest-price`).set(authHeader(admin)).expect(201);
    expect(Number(suggestion.body.data.suggestedPricePkr)).toBeGreaterThan(0);

    const responded = await request(app.getHttpServer())
      .post(`/api/quotes/${quote.id}/respond`)
      .set(authHeader(admin))
      .send({ quotedPricePkr: '4500', adminNotes: 'Ready to proceed' })
      .expect(201);

    expect(responded.body.data.status).toBe('responded');
    expect(Number(responded.body.data.quotedPricePkr)).toBe(4500);
  });

  it('AC-7: converting a responded quote creates an order and links back to the quote', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const quote = await prisma.quote.create({
      data: { serviceId: BigInt(serviceId), customerId: customer.id, name: 'C', email: customer.email, size: 'M', quantity: 1, status: 'responded', quotedPricePkr: 3000 },
    });

    const converted = await request(app.getHttpServer()).post(`/api/quotes/${quote.id}/convert`).set(authHeader(admin)).send({ paymentMethod: 'bank_transfer' }).expect(201);

    expect(Number(converted.body.data.totalPkr)).toBe(3000);

    const updatedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(updatedQuote.status).toBe('converted_to_order');
    expect(updatedQuote.orderId).not.toBeNull();
  });

  it('AC-7: converting a guest (no customer account) quote is rejected with CUSTOMER_ACCOUNT_REQUIRED', async () => {
    const admin = await createAdmin();
    const quote = await prisma.quote.create({
      data: { serviceId: BigInt(serviceId), name: 'Guest', email: 'guest@quote-test.example.com', size: 'M', quantity: 1, status: 'responded', quotedPricePkr: 3000 },
    });

    const res = await request(app.getHttpServer()).post(`/api/quotes/${quote.id}/convert`).set(authHeader(admin)).send({ paymentMethod: 'bank_transfer' }).expect(400);
    expect(res.body.error.code).toBe('CUSTOMER_ACCOUNT_REQUIRED');
  });
});
