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
// docs/specs/2026-08-28-15-taebo-chatbot.md (aspect A-020).
describe('Taebo Helping Panda (docs/specs/2026-08-28-15-taebo-chatbot.md)', () => {
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
    await prisma.taeboWaitingQuestion.deleteMany({ where: { conversation: { sessionId: { contains: '-taebo-test' } } } });
    await prisma.taeboMessage.deleteMany({ where: { conversation: { sessionId: { contains: '-taebo-test' } } } });
    await prisma.taeboConversation.deleteMany({ where: { sessionId: { contains: '-taebo-test' } } });
    await prisma.faq.deleteMany({ where: { topic: { contains: 'taebo-test' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@taebo-test.example.com' } } });
  }

  beforeEach(cleanUp);

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@taebo-test.example.com`, role: 'admin' } });
  }

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@taebo-test.example.com`, role: 'customer' } });
  }

  it('AC-2: a question matching a taebo_visible published FAQ gets an instant, non-escalated answer', async () => {
    await prisma.faq.create({
      data: {
        question: 'What embroidery file formats do you support?',
        answer: 'We support DST, PES, EXP and more.',
        topic: 'taebo-test-formats',
        taeboVisible: true,
        isPublished: true,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/taebo/chat')
      .send({ message: 'What embroidery file formats are supported?', sessionId: `s-${Date.now()}-taebo-test` })
      .expect(201);

    expect(res.body.data.escalated).toBe(false);
    expect(res.body.data.answer).toContain('DST');
    expect(res.body.data.matchedFaqId).toBeTruthy();
  });

  it('AC-3/AC-4: a restricted-topic question always escalates, even with a loosely matching FAQ present', async () => {
    await prisma.faq.create({
      data: {
        question: 'How do I check something about payment?',
        answer: 'Contact us for details.',
        topic: 'taebo-test-payment',
        taeboVisible: true,
        isPublished: true,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/taebo/chat')
      .send({ message: 'Has my payment gone through yet?', sessionId: `s-${Date.now()}-taebo-test` })
      .expect(201);

    expect(res.body.data.escalated).toBe(true);
    expect(res.body.data.answer).toBeUndefined();
  });

  it('AC-3/AC-5: ask -> no-match -> escalate -> admin answers -> customer notified -> save-as-FAQ creates a real faqs row', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const customerAuth = authHeader(customer);

    const chatRes = await request(app.getHttpServer())
      .post('/api/taebo/chat')
      .set(customerAuth)
      .send({ message: 'Do you deliver to a remote research station in Antarctica taebo-test?', sessionId: `s-${Date.now()}-taebo-test` })
      .expect(201);
    expect(chatRes.body.data.escalated).toBe(true);

    const unanswered = await request(app.getHttpServer()).get('/api/taebo/unanswered').set(authHeader(admin)).expect(200);
    const waiting = unanswered.body.data.find((q: { questionText: string }) => q.questionText.includes('Antarctica taebo-test'));
    expect(waiting).toBeTruthy();
    expect(waiting.status).toBe('waiting');

    const answered = await request(app.getHttpServer())
      .post(`/api/taebo/unanswered/${waiting.id}/answer`)
      .set(authHeader(admin))
      .send({ answer: 'Yes, we ship worldwide including remote locations.' })
      .expect(201);
    expect(answered.body.data.status).toBe('answered');

    const notifications = await prisma.notification.findMany({ where: { recipientUserId: customer.id, notificationType: 'taebo_answered' } });
    expect(notifications.length).toBeGreaterThan(0);

    const saved = await request(app.getHttpServer()).post(`/api/taebo/unanswered/${waiting.id}/save-as-faq`).set(authHeader(admin)).expect(201);
    expect(saved.body.data.question).toContain('Antarctica taebo-test');
    expect(saved.body.data.isPublished).toBe(true);
    expect(saved.body.data.taeboVisible).toBe(true);

    const faqRow = await prisma.faq.findUnique({ where: { id: BigInt(saved.body.data.id) } });
    expect(faqRow).not.toBeNull();
  });

  it('AC-2: suggestions endpoint returns page-scoped taebo-visible FAQs', async () => {
    await prisma.faq.create({
      data: {
        question: 'What is included in a catalog design purchase taebo-test?',
        answer: 'The design file and available sizes.',
        topic: 'taebo-test-catalog',
        relatedPage: 'catalog-taebo-test',
        taeboVisible: true,
        isPublished: true,
      },
    });

    const res = await request(app.getHttpServer()).get('/api/taebo/suggestions').query({ page: 'catalog-taebo-test' }).expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].question).toContain('catalog design purchase taebo-test');
  });
});
