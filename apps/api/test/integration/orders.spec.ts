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
// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — bank-transfer receipt ->
// admin-confirm -> file release full flow (AC-3/4/5/6), order history pagination (AC-7), and
// CustomerFilesService correctly blocking/allowing based on order status (AC-6). PayPal/Stripe
// webhook happy-path tests are deliberately NOT here: both providers are unconfigured in the test
// env by design (no real PAYPAL_*/STRIPE_* secrets committed anywhere), so
// PayPalService.verifyWebhookSignature/StripeService.verifyAndParseEvent always return
// false/null — this suite instead asserts that "unconfigured" path itself never transitions an
// order (AC-2's contract holds even with zero credentials on file).
describe('Orders & Payment Processing (docs/specs/2026-08-28-08-orders-payment-processing.md)', () => {
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
    await prisma.customerAuthorizedFile.deleteMany();
    await prisma.paymentReceipt.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.designFile.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '@orders-test.example.com' } } });
  });

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@orders-test.example.com`, role: 'customer' } });
  }

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@orders-test.example.com`, role: 'admin' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  async function createDesignWithFile() {
    const design = await prisma.design.create({
      data: { name: 'Orders Test Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 1500, isPublished: true },
    });
    const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
    await prisma.designFile.create({
      data: { designId: design.id, fileFormat: 'DST', storagePath: '/tmp/does-not-matter', fileSizeBytes: 1024, uploadHash: `hash-${Date.now()}`, isPrivate: true },
    });
    return { design, size };
  }

  async function addToCartAndCheckout(agent: ReturnType<typeof request.agent>, customer: User, designId: string, sizeId: string) {
    await agent.post('/api/cart/items').set(authHeader(customer)).send({ designId, sizeId, quantity: 1 }).expect(201);
    const res = await agent.post('/api/cart/checkout').set(authHeader(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201);
    return res.body.data as { id: string; bankTransferReference: string; status: string };
  }

  it('AC-3/AC-6 (Cart spec): checkout creates a real order with a unique bank-transfer reference and clears the active cart', async () => {
    const customer = await createCustomer();
    const { design, size } = await createDesignWithFile();
    const agent = request.agent(app.getHttpServer());

    const order = await addToCartAndCheckout(agent, customer, design.id.toString(), size.id.toString());

    expect(order.bankTransferReference).toMatch(/^CZD-/);
    expect(order.status).toBe('payment_pending');

    const cartRes = await agent.get('/api/cart').set(authHeader(customer)).expect(200);
    expect(cartRes.body.data.items).toHaveLength(0);
  });

  it('AC-4/AC-5/AC-6: receipt upload -> admin confirm -> files release', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { design, size } = await createDesignWithFile();
    const agent = request.agent(app.getHttpServer());

    const order = await addToCartAndCheckout(agent, customer, design.id.toString(), size.id.toString());

    // Before confirmation, files are blocked (AC-6).
    await agent.get(`/api/orders/${order.id}/files`).set(authHeader(customer)).expect(422);

    await agent
      .post(`/api/orders/${order.id}/receipt`)
      .set(authHeader(customer))
      .attach('file', Buffer.from('fake receipt bytes'), 'receipt.png')
      .expect(201);

    await agent.post(`/api/orders/${order.id}/payment-confirmation`).set(authHeader(admin)).send({ approve: true }).expect(201);

    const filesRes = await agent.get(`/api/orders/${order.id}/files`).set(authHeader(customer)).expect(200);
    expect(filesRes.body.data.length).toBeGreaterThan(0);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(order.id) } });
    expect(updatedOrder.status).toBe('payment_confirmed');
    expect(updatedOrder.paymentStatus).toBe('completed');
  });

  it('AC-5: a rejected receipt returns the order to payment_pending without releasing files', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { design, size } = await createDesignWithFile();
    const agent = request.agent(app.getHttpServer());

    const order = await addToCartAndCheckout(agent, customer, design.id.toString(), size.id.toString());
    await agent.post(`/api/orders/${order.id}/receipt`).set(authHeader(customer)).attach('file', Buffer.from('bad receipt'), 'r.png').expect(201);

    await agent
      .post(`/api/orders/${order.id}/payment-confirmation`)
      .set(authHeader(admin))
      .send({ approve: false, rejectionReason: 'Amount does not match' })
      .expect(201);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(order.id) } });
    expect(updatedOrder.status).toBe('payment_pending');
    await agent.get(`/api/orders/${order.id}/files`).set(authHeader(customer)).expect(422);
  });

  it('AC-7: order history is paginated and scoped to the calling customer', async () => {
    const customer = await createCustomer();
    const other = await createCustomer();
    const { design, size } = await createDesignWithFile();
    const agent = request.agent(app.getHttpServer());
    const otherAgent = request.agent(app.getHttpServer());

    await addToCartAndCheckout(agent, customer, design.id.toString(), size.id.toString());
    await addToCartAndCheckout(otherAgent, other, design.id.toString(), size.id.toString());

    const res = await agent.get('/api/orders/user/history?page=1&pageSize=10').set(authHeader(customer)).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('AC-2: an unconfigured PayPal webhook never transitions an order', async () => {
    const customer = await createCustomer();
    const { design, size } = await createDesignWithFile();
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/cart/items').set(authHeader(customer)).send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const checkoutRes = await agent.post('/api/cart/checkout').set(authHeader(customer)).send({ paymentMethod: 'paypal' }).expect(201);
    const orderId = checkoutRes.body.data.id as string;

    await request(app.getHttpServer())
      .post('/api/webhooks/paypal')
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-1', supplementary_data: { related_ids: { order_id: orderId } } } })
      .expect(422);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(orderId) } });
    expect(order.status).not.toBe('payment_confirmed');
  });
});
