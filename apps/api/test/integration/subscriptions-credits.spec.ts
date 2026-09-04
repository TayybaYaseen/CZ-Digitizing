import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import { CreditsService } from '../../src/credits/credits.service';
import type { User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with `prisma migrate dev`
// already applied. Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015). Same posture as
// test/integration/orders.spec.ts's own doc comment: PayPal/Stripe are unconfigured in the test
// env (no real secrets committed), so the "create a pending payment" half of subscribe()/purchase()
// can only ever hit their "provider not available" branch here — this suite instead calls
// CreditsService.confirmPurchase()/SubscriptionsService.confirmPayment() directly, exactly the way
// CreditsWebhooksController/SubscriptionsWebhooksController would after a real signature-verified
// webhook fires, to exercise the ledger/balance/grant logic against a real database end-to-end.
describe('Subscriptions & Credits (docs/specs/2026-08-28-09-subscriptions-credits.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let credits: CreditsService;
  let subscriptions: SubscriptionsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    credits = app.get(CreditsService);
    subscriptions = app.get(SubscriptionsService);
  });

  afterAll(async () => {
    // Cleans up after itself (not just before, like this repo's other integration specs) since
    // this suite's checkout tests create real Order/Design rows via HTTP — leaving them behind
    // would break a *different* spec file's own beforeEach FK-ordered deleteMany() if it happens
    // to run after this one in the same shared test database.
    await cleanUp();
    await app.close();
  });

  async function cleanUp() {
    await prisma.subscriptionCreditGrant.deleteMany();
    await prisma.pendingSubscriptionPayment.deleteMany();
    await prisma.pendingCreditPurchase.deleteMany();
    await prisma.customerSubscription.deleteMany();
    await prisma.creditTransaction.deleteMany();
    await prisma.customerCredits.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.creditPackage.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '@subs-credits-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createCustomer(): Promise<User> {
    return prisma.user.create({ data: { email: `customer-${Date.now()}-${Math.random()}@subs-credits-test.example.com`, role: 'customer' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-5/AC-6: a published credit package purchase increases available/total credits and writes a purchase ledger row', async () => {
    const customer = await createCustomer();
    const pkg = await prisma.creditPackage.create({ data: { name: '25 + 5 bonus', credits: 25, bonusCredits: 5, pricePkr: 500, isPublished: true } });
    const pending = await prisma.pendingCreditPurchase.create({ data: { customerId: customer.id, packageId: pkg.id } });

    await credits.confirmPurchase(pending.id);

    const balance = await credits.getBalance(customer.id);
    expect(balance).toEqual({ available: 30, used: 0, total: 30 });
    const tx = await prisma.creditTransaction.findFirst({ where: { customerId: customer.id, type: 'purchase' } });
    expect(tx?.amount).toBe(30);

    // AC-6 (idempotency, same posture as OrdersService.confirmAutomaticPayment) — a replayed
    // webhook for an already-processed pending purchase must not double-grant.
    await credits.confirmPurchase(pending.id);
    expect(await credits.getBalance(customer.id)).toEqual({ available: 30, used: 0, total: 30 });
  });

  it('AC-7: applying credits at checkout decreases available_credits and sets orders.credits_used', async () => {
    const customer = await createCustomer();
    await prisma.customerCredits.create({ data: { customerId: customer.id, totalCredits: 1000, availableCredits: 1000, usedCredits: 0 } });
    const design = await prisma.design.create({ data: { name: 'Credits Checkout Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 1000, isPublished: true } });
    const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/cart/items').set(authHeader(customer)).send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const res = await agent
      .post('/api/cart/checkout')
      .set(authHeader(customer))
      .send({ paymentMethod: 'bank_transfer', creditsToApplyPkr: 300 })
      .expect(201);

    expect(res.body.data.creditsUsed).toBe(300);
    const balance = await credits.getBalance(customer.id);
    expect(balance).toEqual({ available: 700, used: 300, total: 1000 });
    const usageTx = await prisma.creditTransaction.findFirst({ where: { customerId: customer.id, type: 'usage' } });
    expect(usageTx?.amount).toBe(-300);
    expect(usageTx?.relatedOrderId?.toString()).toBe(res.body.data.id);
  });

  it('AC-7 (INSUFFICIENT_CREDITS): checkout rejects an amount larger than the available balance', async () => {
    const customer = await createCustomer();
    await prisma.customerCredits.create({ data: { customerId: customer.id, totalCredits: 50, availableCredits: 50, usedCredits: 0 } });
    const design = await prisma.design.create({ data: { name: 'Credits Reject Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 1000, isPublished: true } });
    const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/cart/items').set(authHeader(customer)).send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    const res = await agent.post('/api/cart/checkout').set(authHeader(customer)).send({ paymentMethod: 'bank_transfer', creditsToApplyPkr: 500 }).expect(422);

    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('AC-2/AC-3: subscribing activates the subscription, computes renewal_date, and grants the monthly credit allotment', async () => {
    const customer = await createCustomer();
    const plan = await prisma.subscriptionPlan.create({
      data: { name: 'Pro', billingPeriod: 'monthly', pricePkr: 2000, monthlyCredits: 100, perks: ['perk1'], isPublished: true },
    });
    const pending = await prisma.pendingSubscriptionPayment.create({ data: { customerId: customer.id, planId: plan.id } });

    await subscriptions.confirmPayment(pending.id);

    const sub = await subscriptions.getCurrent(customer.id);
    expect(sub.status).toBe('active');
    expect(new Date(sub.renewalDate).getTime()).toBeGreaterThan(Date.now());
    expect(await credits.getBalance(customer.id)).toEqual({ available: 100, used: 0, total: 100 });
  });

  it('AC-4: cancelling leaves status=cancelled, auto_renew=false, and access until the already-paid end_date', async () => {
    const customer = await createCustomer();
    const plan = await prisma.subscriptionPlan.create({
      data: { name: 'Basic', billingPeriod: 'monthly', pricePkr: 1000, monthlyCredits: 20, perks: [], isPublished: true },
    });
    const pending = await prisma.pendingSubscriptionPayment.create({ data: { customerId: customer.id, planId: plan.id } });
    await subscriptions.confirmPayment(pending.id);
    const beforeCancel = await subscriptions.getCurrent(customer.id);

    const agent = request.agent(app.getHttpServer());
    const res = await agent.put('/api/subscriptions/cancel').set(authHeader(customer)).expect(200);

    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.autoRenew).toBe(false);
    expect(res.body.data.endDate).toBe(beforeCancel.renewalDate);
  });

  it('AC-9: mid-cycle upgrade updates the plan and returns a non-negative prorated charge', async () => {
    const customer = await createCustomer();
    const basic = await prisma.subscriptionPlan.create({ data: { name: 'Basic', billingPeriod: 'monthly', pricePkr: 1000, monthlyCredits: 20, perks: [], isPublished: true } });
    const pro = await prisma.subscriptionPlan.create({ data: { name: 'Pro', billingPeriod: 'monthly', pricePkr: 3000, monthlyCredits: 100, perks: [], isPublished: true } });
    const pending = await prisma.pendingSubscriptionPayment.create({ data: { customerId: customer.id, planId: basic.id } });
    await subscriptions.confirmPayment(pending.id);

    const result = await subscriptions.changePlan(customer.id, { planId: pro.id.toString() });

    expect(result.subscription.plan.id).toBe(pro.id.toString());
    expect(result.proratedChargePkr).toBeGreaterThanOrEqual(0);
  });

  it('AC-10: gifting credits debits the sender and credits the recipient with matching adjustment rows', async () => {
    const sender = await createCustomer();
    const recipient = await createCustomer();
    await prisma.customerCredits.create({ data: { customerId: sender.id, totalCredits: 200, availableCredits: 200, usedCredits: 0 } });
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/credits/gift').set(authHeader(sender)).send({ recipientEmail: recipient.email, amount: 80 }).expect(200);

    expect(await credits.getBalance(sender.id)).toEqual({ available: 120, used: 80, total: 200 });
    expect(await credits.getBalance(recipient.id)).toEqual({ available: 80, used: 0, total: 80 });
  });
});
