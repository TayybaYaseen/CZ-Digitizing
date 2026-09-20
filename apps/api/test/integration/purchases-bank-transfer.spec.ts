/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md AC-12 + docs/specs/2026-08-28-09-subscriptions-
// credits.md AC-2/AC-3/AC-5/AC-6 — BANK TRANSFER ONLY. A credit package, a subscription sign-up and a
// renewal are each an ordinary bank-transfer order: exact PKR amount, bank details, receipt, Admin
// approval. Only the approval grants the credits / activates the subscription, and only once.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
jest.setTimeout(60_000);

describe('credit packages, subscriptions and renewals are bank-transfer orders', () => {
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

  const buyCredits = (customer: any, packageId: string) => h.http().post('/api/credits/purchase').set(h.auth(customer)).send({ packageId });
  const subscribe = (customer: any, planId: string) => h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId });
  const balance = async (customer: any) => h.services.credits.getBalance(customer.id);

  describe('credit package purchase', () => {
    it('creates a payment_pending bank-transfer order for the exact PKR price — and grants nothing yet', async () => {
      const customer = await h.mkUser('customer');
      const pkg = await h.mkPackage({ name: 'Starter', credits: 25, bonusCredits: 5, pricePkr: 500 });

      const res = await buyCredits(customer, pkg.id.toString()).expect(201);

      expect(res.body.data).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', paymentMethod: 'bank_transfer', transactionType: 'purchase', totalPkr: 500, amountDuePkr: 500, creditsUsed: 0 });
      expect(res.body.data.bankTransferReference).toMatch(/^CZD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(res.body.data.items[0]).toMatchObject({ name: 'Credit package "Starter" (30 credits)', quantity: 1, linePricePkr: 500 });
      expect(res.body.data).not.toHaveProperty('payment');
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 });
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'order_confirmed' } }))?.message).toContain('PKR 500');
    });

    it('asking again while the first order is still unpaid returns that same order (no duplicate payment request)', async () => {
      const customer = await h.mkUser('customer');
      const pkg = await h.mkPackage();
      const first = await buyCredits(customer, pkg.id.toString()).expect(201);
      const second = await buyCredits(customer, pkg.id.toString()).expect(201);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(second.body.data.bankTransferReference).toBe(first.body.data.bankTransferReference);
      expect(await h.prisma.order.count()).toBe(1);
    });

    it('receipt upload -> Admin approval adds the package credits exactly once and completes the order', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage({ credits: 25, bonusCredits: 5 });
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 }); // uploading proves nothing

      await h.approve(admin, order.id).expect(201);

      expect(await balance(customer)).toEqual({ available: 30, used: 0, total: 30 });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'completed', paymentStatus: 'completed' });
      const ledger = await h.prisma.creditTransaction.findMany({ where: { customerId: customer.id, type: 'purchase' } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ amount: 30, relatedOrderId: BigInt(order.id) });
      expect(await h.notifCount(customer, 'credit_purchase')).toBe(1);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);

      // duplicate approval / late upload: nothing more happens
      expect(h.errCode(await h.approve(admin, order.id))).toBe('ORDER_ALREADY_CONFIRMED');
      expect(h.errCode(await h.uploadReceipt(customer, order.id))).toBe('ORDER_ALREADY_CONFIRMED');
      expect(await balance(customer)).toEqual({ available: 30, used: 0, total: 30 });
    });

    it('two admins approving at the same instant grant the credits once', async () => {
      const customer = await h.mkUser('customer');
      const admin1 = await h.mkUser('admin');
      const admin2 = await h.mkUser('admin');
      const pkg = await h.mkPackage({ credits: 40, bonusCredits: 0 });
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);

      const results = await Promise.all([h.approve(admin1, order.id), h.approve(admin2, order.id)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await balance(customer)).toEqual({ available: 40, used: 0, total: 40 });
      expect(await h.prisma.creditTransaction.count({ where: { relatedOrderId: BigInt(order.id), type: 'purchase' } })).toBe(1);
    });

    it('a rejected receipt grants nothing; a corrected receipt on the same order then works', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage({ credits: 10, bonusCredits: 0 });
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);

      await h.reject(admin, order.id, 'Wrong amount').expect(201);
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });

      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);
      expect(await balance(customer)).toEqual({ available: 10, used: 0, total: 10 });
    });

    it('a cancelled order can never be revived by a late receipt: no credits', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage();
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);

      const res = await h.approve(admin, order.id);
      expect([res.status, h.errCode(res)]).toEqual([409, 'ORDER_NOT_PAYABLE']);
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
    });

    it('cannot be confirmed by a status edit (PUT /status -> payment_confirmed is refused) and credits stay at zero', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage();
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      const res = await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect(res.status).toBe(422); // RECEIPT_REQUIRED
      await h.uploadReceipt(customer, order.id).expect(201);
      const res2 = await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect([res2.status, h.errCode(res2)]).toEqual([409, 'PAYMENT_CONFIRMATION_REQUIRED']);
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 });
    });

    it('unpublished / unknown / malformed package -> 404; paypal or stripe as the method -> 400; anonymous -> 401', async () => {
      const customer = await h.mkUser('customer');
      const hidden = await h.mkPackage({ isPublished: false });
      await buyCredits(customer, hidden.id.toString()).expect(404);
      await buyCredits(customer, '999999').expect(404);
      await buyCredits(customer, 'abc').expect(404);
      const pkg = await h.mkPackage();
      for (const paymentMethod of ['paypal', 'stripe']) {
        await h.http().post('/api/credits/purchase').set(h.auth(customer)).send({ packageId: pkg.id.toString(), paymentMethod }).expect(400);
      }
      await h.http().post('/api/credits/purchase').send({ packageId: pkg.id.toString() }).expect(401);
      expect(await h.prisma.order.count()).toBe(0);
    });

    it('the price is a snapshot: editing the package after ordering changes neither the amount nor the credits granted', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage({ credits: 25, bonusCredits: 5, pricePkr: 500 });
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.prisma.creditPackage.update({ where: { id: pkg.id }, data: { credits: 999, pricePkr: 9999 } });
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);
      expect((await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer))).body.data.totalPkr).toBe(500);
      expect(await balance(customer)).toEqual({ available: 30, used: 0, total: 30 });
    });

    it('such an order cannot be refunded through the refund endpoint (the credits would not be taken back): 409 REFUND_NOT_SUPPORTED', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage();
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);

      const res = await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({});
      expect([res.status, h.errCode(res)]).toEqual([409, 'REFUND_NOT_SUPPORTED']);
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'completed', paymentStatus: 'completed' });
    });

    it('a package that has been ordered can no longer be deleted (409) — unpublish it instead; a never-ordered one can', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const ordered = await h.mkPackage({ name: 'Ordered' });
      const unused = await h.mkPackage({ name: 'Unused' });
      await buyCredits(customer, ordered.id.toString()).expect(201);

      const blocked = await h.http().delete(`/api/credits/admin/packages/${ordered.id}`).set(h.auth(admin));
      expect([blocked.status, h.errCode(blocked)]).toEqual([409, 'CONFLICT']);
      await h.http().delete(`/api/credits/admin/packages/${unused.id}`).set(h.auth(admin)).expect(204);
    });

    it('the credit-purchase order shows in the Admin receipt queue once a receipt is uploaded', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const pkg = await h.mkPackage();
      const order = (await buyCredits(customer, pkg.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);
      const queue = (await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin)).expect(200)).body;
      expect(queue.data.map((o: any) => o.id)).toEqual([order.id]);
      expect(queue.data[0]).toMatchObject({ amountDuePkr: 500, paymentMethod: 'bank_transfer' });
    });
  });

  describe('subscription first payment', () => {
    it('subscribing creates a bank-transfer order for the plan price; nothing is active until Admin approves the receipt', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const plan = await h.mkPlan({ name: 'Pro', pricePkr: 2000, monthlyCredits: 100 });

      const order = (await subscribe(customer, plan.id.toString()).expect(201)).body.data;
      expect(order).toMatchObject({ status: 'payment_pending', paymentMethod: 'bank_transfer', transactionType: 'purchase', totalPkr: 2000, amountDuePkr: 2000 });
      expect(order.items[0].name).toBe('Subscription "Pro" (monthly)');
      await h.http().get('/api/subscriptions/current').set(h.auth(customer)).expect(404);
      expect(await balance(customer)).toEqual({ available: 0, used: 0, total: 0 });

      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);

      const current = (await h.http().get('/api/subscriptions/current').set(h.auth(customer)).expect(200)).body.data;
      expect(current).toMatchObject({ status: 'active', autoRenew: true });
      expect(new Date(current.renewalDate).getTime()).toBeGreaterThan(Date.now());
      expect(await balance(customer)).toEqual({ available: 100, used: 0, total: 100 });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'completed', paymentStatus: 'completed' });
      expect(await h.notifCount(customer, 'subscription_renewal')).toBe(1);

      // already subscribed now
      const again = await subscribe(customer, plan.id.toString());
      expect([again.status, h.errCode(again)]).toEqual([409, 'ALREADY_SUBSCRIBED']);
    });

    it('duplicate approval never grants the monthly credits twice', async () => {
      const customer = await h.mkUser('customer');
      const admin1 = await h.mkUser('admin');
      const admin2 = await h.mkUser('admin');
      const plan = await h.mkPlan({ monthlyCredits: 100 });
      const order = (await subscribe(customer, plan.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);

      await Promise.all([h.approve(admin1, order.id), h.approve(admin2, order.id)]);
      await h.approve(admin1, order.id);

      expect(await balance(customer)).toEqual({ available: 100, used: 0, total: 100 });
      expect(await h.prisma.subscriptionCreditGrant.count()).toBe(1);
    });

    it('unpublished plan -> 404; paypal/stripe as the method -> 400; the plan cannot be deleted once ordered', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const hidden = await h.mkPlan({ isPublished: false });
      await subscribe(customer, hidden.id.toString()).expect(404);
      const plan = await h.mkPlan();
      for (const paymentMethod of ['paypal', 'stripe']) {
        await h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId: plan.id.toString(), paymentMethod }).expect(400);
      }
      await subscribe(customer, plan.id.toString()).expect(201);
      const blocked = await h.http().delete(`/api/subscriptions/admin/plans/${plan.id}`).set(h.auth(admin));
      expect([blocked.status, h.errCode(blocked)]).toEqual([409, 'CONFLICT']);
    });
  });

  describe('AC-12 renewals follow the same order / bank-transfer workflow, tagged as renewals', () => {
    async function activeSubscription(customer: any, admin: any, plan: any) {
      const order = (await subscribe(customer, plan.id.toString()).expect(201)).body.data;
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);
      // make it due
      await h.prisma.customerSubscription.update({ where: { customerId: customer.id }, data: { renewalDate: new Date(Date.now() - 60_000) } });
      return h.prisma.customerSubscription.findUniqueOrThrow({ where: { customerId: customer.id }, include: { plan: true } });
    }
    const dueSub = (customer: any) => h.prisma.customerSubscription.findUniqueOrThrow({ where: { customerId: customer.id }, include: { plan: true } });

    it('a due renewal creates ONE bank-transfer order tagged "renewal" for the exact plan price and reuses it on later reminders', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const plan = await h.mkPlan({ pricePkr: 2000 });
      const sub = await activeSubscription(customer, admin, plan);

      await h.services.purchases.attemptRenewal(sub);
      await h.services.purchases.attemptRenewal(await dueSub(customer));

      const renewals = await h.prisma.order.findMany({ where: { customerId: customer.id, transactionType: 'renewal' } });
      expect(renewals).toHaveLength(1);
      expect(renewals[0]).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', paymentMethod: 'bank_transfer' });
      expect(Number(renewals[0].totalPkr)).toBe(2000);
      expect(renewals[0].bankTransferReference).toMatch(/^CZD-/);
      const reminder = await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'subscription_renewal_failed' }, orderBy: { id: 'asc' } });
      expect(reminder?.message).toContain('PKR 2,000');
      expect(reminder?.message).toContain(`/checkout/bank-transfer/${renewals[0].id}`);
      expect(reminder?.message).not.toMatch(/PayPal|Stripe|USD/i);
    });

    it('approving the renewal receipt extends the subscription, grants the monthly credits again and clears the dunning counters', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const plan = await h.mkPlan({ pricePkr: 2000, monthlyCredits: 100 });
      const sub = await activeSubscription(customer, admin, plan);
      await h.services.purchases.attemptRenewal(sub);
      const renewal = await h.prisma.order.findFirstOrThrow({ where: { customerId: customer.id, transactionType: 'renewal' } });

      await h.uploadReceipt(customer, renewal.id.toString()).expect(201);
      await h.approve(admin, renewal.id.toString()).expect(201);

      const after = await dueSub(customer);
      expect(after).toMatchObject({ status: 'active', failedRenewalCount: 0 });
      expect(after.renewalDate.getTime()).toBeGreaterThan(Date.now());
      expect(await balance(customer)).toEqual({ available: 200, used: 0, total: 200 });
      expect(await h.orderRow(renewal.id.toString())).toMatchObject({ status: 'completed', paymentStatus: 'completed' });
      expect((await h.notifCount(customer, 'subscription_renewal'))).toBe(2); // activated + renewed
    });

    it('unpaid renewals lapse after the 3rd missed reminder; a receipt already awaiting review is NOT a missed attempt', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const plan = await h.mkPlan();
      const sub = await activeSubscription(customer, admin, plan);

      await h.services.purchases.attemptRenewal(sub);
      expect((await dueSub(customer)).failedRenewalCount).toBe(1);

      // customer pays and uploads a receipt: further daily runs must not count against them
      const renewal = await h.prisma.order.findFirstOrThrow({ where: { customerId: customer.id, transactionType: 'renewal' } });
      await h.uploadReceipt(customer, renewal.id.toString()).expect(201);
      await h.services.purchases.attemptRenewal(await dueSub(customer));
      await h.services.purchases.attemptRenewal(await dueSub(customer));
      expect(await dueSub(customer)).toMatchObject({ failedRenewalCount: 1, status: 'active' });

      // Admin rejects it -> the customer is back to owing, and missed reminders count again
      await h.reject(admin, renewal.id.toString(), 'Blurry').expect(201);
      await h.services.purchases.attemptRenewal(await dueSub(customer));
      await h.services.purchases.attemptRenewal(await dueSub(customer));
      expect(await dueSub(customer)).toMatchObject({ failedRenewalCount: 3, status: 'lapsed', autoRenew: false });
      expect(await h.prisma.order.count({ where: { customerId: customer.id, transactionType: 'renewal' } })).toBe(1);
    });

    it('a lapsed customer who then pays the outstanding renewal order is reactivated', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const plan = await h.mkPlan({ monthlyCredits: 100 });
      let sub = await activeSubscription(customer, admin, plan);
      for (let i = 0; i < 3; i++) {
        await h.services.purchases.attemptRenewal(sub);
        sub = await dueSub(customer);
      }
      expect(sub.status).toBe('lapsed');
      const renewal = await h.prisma.order.findFirstOrThrow({ where: { customerId: customer.id, transactionType: 'renewal' } });

      await h.uploadReceipt(customer, renewal.id.toString()).expect(201);
      await h.approve(admin, renewal.id.toString()).expect(201);

      expect(await dueSub(customer)).toMatchObject({ status: 'active', autoRenew: true, failedRenewalCount: 0 });
    });
  });
});
