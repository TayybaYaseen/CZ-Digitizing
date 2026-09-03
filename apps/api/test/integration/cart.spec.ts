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
// docs/specs/2026-08-28-07-shopping-cart-checkout.md — add/update/remove, guest-cookie
// persistence, merge-on-login, and checkout's pre-validation + ORDERS_NOT_AVAILABLE stub. AC-6's
// actual order creation and AC-4's real credit balance can't be integration-tested without
// A-013/A-015 (both still Blocked per docs/specs/SPEC_INDEX.md) — deferred to those aspects' own
// suites, not fabricated here.
describe('Shopping Cart & Checkout (docs/specs/2026-08-28-07-shopping-cart-checkout.md)', () => {
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
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '@cart-test.example.com' } } });
  });

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@cart-test.example.com`, role: 'customer' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  async function createDesign(overrides: { isPublished?: boolean } = {}) {
    const design = await prisma.design.create({
      data: { name: 'Cart Test Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 500, isPublished: overrides.isPublished ?? true },
    });
    const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
    return { design, size };
  }

  it('AC-1/AC-3: a guest adds an item, and its cookie persists the cart across separate requests', async () => {
    const { design, size } = await createDesign();
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 2 }).expect(201);

    const res = await agent.get('/api/cart').expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it('AC-3: updating quantity and removing an item recomputes the cart total', async () => {
    const { design, size } = await createDesign();
    const agent = request.agent(app.getHttpServer());
    const addRes = await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const itemId = addRes.body.data.items[0].id as string;

    await agent.put(`/api/cart/items/${itemId}`).send({ quantity: 5 }).expect(200);
    let res = await agent.get('/api/cart').expect(200);
    expect(res.body.data.items[0].quantity).toBe(5);
    expect(res.body.data.subtotalPkr).toBe(2500);

    await agent.delete(`/api/cart/items/${itemId}`).expect(204);
    res = await agent.get('/api/cart').expect(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.subtotalPkr).toBe(0);
  });

  it('AC-1: rejects a design item added without a required size (SIZE_REQUIRED)', async () => {
    const { design } = await createDesign();
    const res = await request(app.getHttpServer()).post('/api/cart/items').send({ designId: design.id.toString(), quantity: 1 }).expect(422);
    expect(res.body.error.code).toBe('SIZE_REQUIRED');
  });

  it('AC-6: unpublishing a cart item makes checkout fail validation with ITEM_NOT_PUBLISHED before the ORDERS_NOT_AVAILABLE stub', async () => {
    const { design, size } = await createDesign();
    const customer = await createCustomer();
    const agent = request.agent(app.getHttpServer());
    agent.set(authHeader(customer));

    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    await prisma.design.update({ where: { id: design.id }, data: { isPublished: false } });

    const res = await agent.post('/api/cart/checkout').send({}).expect(422);
    expect(res.body.error.code).toBe('ITEM_NOT_PUBLISHED');
  });

  it('AC-6: checkout on a fully valid cart fails with the honest ORDERS_NOT_AVAILABLE stub, never a fabricated success', async () => {
    const { design, size } = await createDesign();
    const customer = await createCustomer();
    const agent = request.agent(app.getHttpServer());
    agent.set(authHeader(customer));

    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);

    const res = await agent.post('/api/cart/checkout').send({}).expect(501);
    expect(res.body.error.code).toBe('ORDERS_NOT_AVAILABLE');
  });

  it('a guest cannot checkout — requires an authenticated customer', async () => {
    const { design, size } = await createDesign();
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    await agent.post('/api/cart/checkout').send({}).expect(401);
  });

  it('AC-5: merging folds a guest cart into the customer cart and sums a matching line', async () => {
    const { design, size } = await createDesign();
    const customer = await createCustomer();
    const agent = request.agent(app.getHttpServer());

    // Guest adds an item first — this mints the guest-cart cookie the agent keeps for every
    // subsequent request, including the authenticated merge call below.
    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);

    agent.set(authHeader(customer));
    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 2 }).expect(201); // lands on the customer's own cart, not the guest one

    const mergeRes = await agent.post('/api/cart/merge').send({}).expect(201);
    expect(mergeRes.body.data.items).toHaveLength(1);
    expect(mergeRes.body.data.items[0].quantity).toBe(3);
  });

  it('AC-8: saving an item for later removes it from the active total, and it can move back', async () => {
    const { design, size } = await createDesign();
    const agent = request.agent(app.getHttpServer());
    const addRes = await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const itemId = addRes.body.data.items[0].id as string;

    let res = await agent.put(`/api/cart/items/${itemId}/save-for-later`).send({}).expect(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.savedForLater).toHaveLength(1);
    expect(res.body.data.subtotalPkr).toBe(0);

    res = await agent.put(`/api/cart/items/${itemId}/move-to-cart`).send({}).expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.savedForLater).toHaveLength(0);
  });

  it('a cart item cannot be updated or removed by a different guest session (own-cart-only)', async () => {
    const { design, size } = await createDesign();
    const ownerAgent = request.agent(app.getHttpServer());
    const addRes = await ownerAgent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const itemId = addRes.body.data.items[0].id as string;

    const otherAgent = request.agent(app.getHttpServer());
    const res = await otherAgent.put(`/api/cart/items/${itemId}`).send({ quantity: 9 }).expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('AC-4: applying credits with no balance available rejects with INSUFFICIENT_CREDITS', async () => {
    const customer = await createCustomer();
    const res = await request(app.getHttpServer())
      .post('/api/cart/credits')
      .set(authHeader(customer))
      .send({ amountPkr: 100 })
      .expect(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });
});
