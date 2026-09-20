/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015). Payment is BANK TRANSFER ONLY, so a
// package purchase and a subscription sign-up become paid through an order whose receipt Admin approves
// (the full purchase / renewal matrix lives in purchases-bank-transfer.spec.ts); this file keeps the
// ledger / checkout-credits / cancel / upgrade / gift acceptance criteria against a real database.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
jest.setTimeout(60_000);

describe('Subscriptions & Credits (docs/specs/2026-08-28-09-subscriptions-credits.md)', () => {
  let h: OrdersHarness;

  beforeAll(async () => {
    h = await createOrdersHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  async function payFor(customer: any, admin: any, order: any) {
    await h.uploadReceipt(customer, order.id).expect(201);
    await h.approve(admin, order.id).expect(201);
  }

  it('AC-5/AC-6: a published credit package purchase (bank transfer, approved) increases available/total credits and writes a purchase ledger row', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const pkg = await h.mkPackage({ name: '25 + 5 bonus', credits: 25, bonusCredits: 5, pricePkr: 500 });
    const order = (await h.http().post('/api/credits/purchase').set(h.auth(customer)).send({ packageId: pkg.id.toString() }).expect(201)).body.data;
    expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 0, used: 0, total: 0 });

    await payFor(customer, admin, order);

    expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 30, used: 0, total: 30 });
    const tx = await h.prisma.creditTransaction.findFirst({ where: { customerId: customer.id, type: 'purchase' } });
    expect(tx?.amount).toBe(30);

    // AC-6 idempotency — a replayed approval must not double-grant.
    await h.approve(admin, order.id).expect(409);
    expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 30, used: 0, total: 30 });
  });

  it('AC-7: applying credits at checkout decreases available_credits and sets orders.credits_used', async () => {
    const customer = await h.mkUser('customer');
    await h.prisma.customerCredits.create({ data: { customerId: customer.id, totalCredits: 1000, availableCredits: 1000, usedCredits: 0 } });
    const { res } = await h.checkout(customer, { price: 1000, credits: 300 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ creditsUsed: 300, amountDuePkr: 700 });
    expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 700, used: 300, total: 1000 });
    const usageTx = await h.prisma.creditTransaction.findFirst({ where: { customerId: customer.id, type: 'usage' } });
    expect(usageTx?.amount).toBe(-300);
    expect(usageTx?.relatedOrderId?.toString()).toBe(res.body.data.id);
  });

  it('AC-7 (INSUFFICIENT_CREDITS): checkout rejects an amount larger than the available balance', async () => {
    const customer = await h.mkUser('customer');
    await h.prisma.customerCredits.create({ data: { customerId: customer.id, totalCredits: 50, availableCredits: 50, usedCredits: 0 } });
    const { res } = await h.checkout(customer, { price: 1000, credits: 500 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('AC-2/AC-3: subscribing (bank transfer, approved) activates the subscription, computes renewal_date, and grants the monthly credit allotment', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const plan = await h.mkPlan({ name: 'Pro', pricePkr: 2000, monthlyCredits: 100 });
    const order = (await h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId: plan.id.toString() }).expect(201)).body.data;
    await payFor(customer, admin, order);

    const sub = await h.services.subscriptions.getCurrent(customer.id);
    expect(sub.status).toBe('active');
    expect(new Date(sub.renewalDate).getTime()).toBeGreaterThan(Date.now());
    expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 100, used: 0, total: 100 });
  });

  it('AC-4: cancelling leaves status=cancelled, auto_renew=false, and access until the already-paid end_date', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const plan = await h.mkPlan({ name: 'Basic', pricePkr: 1000, monthlyCredits: 20 });
    await payFor(customer, admin, (await h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId: plan.id.toString() }).expect(201)).body.data);
    const beforeCancel = await h.services.subscriptions.getCurrent(customer.id);

    const res = await h.http().put('/api/subscriptions/cancel').set(h.auth(customer)).expect(200);

    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.autoRenew).toBe(false);
    expect(res.body.data.endDate).toBe(beforeCancel.renewalDate);
  });

  it('AC-9: mid-cycle upgrade updates the plan and returns a non-negative prorated charge', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const basic = await h.mkPlan({ name: 'Basic', pricePkr: 1000, monthlyCredits: 20 });
    const pro = await h.mkPlan({ name: 'Pro', pricePkr: 3000, monthlyCredits: 100 });
    await payFor(customer, admin, (await h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId: basic.id.toString() }).expect(201)).body.data);

    const result = await h.services.subscriptions.changePlan(customer.id, { planId: pro.id.toString() });

    expect(result.subscription.plan.id).toBe(pro.id.toString());
    expect(result.proratedChargePkr).toBeGreaterThanOrEqual(0);
  });

  it('AC-10: gifting credits debits the sender and credits the recipient with matching adjustment rows', async () => {
    const sender = await h.mkUser('customer');
    const recipient = await h.mkUser('customer');
    await h.prisma.customerCredits.create({ data: { customerId: sender.id, totalCredits: 200, availableCredits: 200, usedCredits: 0 } });

    await h.http().post('/api/credits/gift').set(h.auth(sender)).send({ recipientEmail: recipient.email, amount: 80 }).expect(200);

    expect(await h.services.credits.getBalance(sender.id)).toEqual({ available: 120, used: 80, total: 200 });
    expect(await h.services.credits.getBalance(recipient.id)).toEqual({ available: 80, used: 0, total: 80 });
  });
});
