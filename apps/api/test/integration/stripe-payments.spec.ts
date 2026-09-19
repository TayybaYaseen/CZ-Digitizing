/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md §6 — "Stripe credit/debit card checkout,
// 3D Secure, and webhook confirmation" (AC-10) plus the A-013 critical fixes: correct provider
// amount/currency, webhook amount/currency validation, duplicate-event idempotency.
//
// What is real here: Stripe's webhook signature verification (the real SDK's constructEvent), the
// whole order/confirmation state machine, and the database. What is faked: the two Stripe API calls
// that need a live account (paymentIntents.create / .retrieve) — see FakeStripe. 3-D Secure itself
// runs in the customer's browser inside Stripe's Payment Element and is out of any backend test's
// reach; the backend's part is verifying the final outcome, which is what these tests cover.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
describe('A-013 Stripe card payments', () => {
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

  async function stripeOrder(opts: { price?: number; credits?: number } = {}) {
    const customer = await h.mkUser('customer');
    if (opts.credits) await h.grantCredits(customer, opts.credits);
    const { res, order } = await h.checkout(customer, 'stripe', opts);
    return { customer, res, order, intentId: `pi_test_${h.stripe.seq}` };
  }

  describe('customer can actually start the payment (AC-10)', () => {
    it('checkout returns the client secret + publishable key for the Payment Element; the intent is 539 cents — NOT 150,000', async () => {
      const { res, order } = await stripeOrder({ price: 1500 });

      expect(res.status).toBe(201);
      expect(order.payment).toEqual({
        provider: 'stripe',
        approveUrl: null,
        clientSecret: 'pi_test_1_secret_test',
        publishableKey: 'pk_test_orders_harness',
        currency: 'USD',
        amount: '5.39',
        amountMinor: 539,
      });
      expect(order.totalPkr).toBe(1500);
      expect(order.providerCharge).toEqual({ currency: 'USD', amount: '5.39', amountMinor: 539, amountPkr: 1500, rateToPkr: 278.5 });

      const { params } = h.stripe.createCalls[0];
      expect(params).toMatchObject({ amount: 539, currency: 'usd', automatic_payment_methods: { enabled: true }, metadata: { orderId: order.id } });
      expect(params.amount).not.toBe(150000);

      expect(await h.orderRow(order.id)).toMatchObject({ stripePaymentIntentId: 'pi_test_1', providerCurrency: 'USD', providerAmountMinor: 539, status: 'payment_pending' });
    });

    it('credits reduce what the card is charged (1,500 − 500 credits = PKR 1,000 → 359 cents)', async () => {
      const { order } = await stripeOrder({ price: 1500, credits: 500 });
      expect(h.stripe.createCalls[0].params.amount).toBe(359);
      expect(order.providerCharge).toMatchObject({ amountPkr: 1000, amountMinor: 359 });
    });

    it('payment-session returns the SAME client secret after a reload, and replaces a cancelled intent', async () => {
      const { customer, order, intentId } = await stripeOrder();
      const again = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(again.body.data).toMatchObject({ provider: 'stripe', clientSecret: `${intentId}_secret_test`, publishableKey: 'pk_test_orders_harness', amount: '5.39' });
      expect(h.stripe.createCalls).toHaveLength(1);

      h.stripe.setStatus(intentId, 'canceled');
      const fresh = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(fresh.body.data.clientSecret).toBe('pi_test_2_secret_test');
      expect(h.stripe.createCalls[1].params.amount).toBe(539);
      expect((await h.orderRow(order.id)).stripePaymentIntentId).toBe('pi_test_2');
    });

    it('Stripe down at checkout: the order exists and payment-session retries once Stripe recovers', async () => {
      h.stripe.failCreate = true;
      const customer = await h.mkUser('customer');
      const { res, order } = await h.checkout(customer, 'stripe');
      expect(res.status).toBe(201);
      expect(order.payment).toBeNull();

      h.stripe.failCreate = false;
      const retry = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(retry.body.data.clientSecret).toBeTruthy();
    });

    it('not configured -> 503 PAYMENT_METHOD_UNAVAILABLE and no order', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign();
      await h.addToCart(customer, design, size);
      jest.spyOn(h.services.stripeService, 'canCreatePayments').mockReturnValueOnce(false);
      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'stripe' });
      expect(res.status).toBe(503);
      expect(h.errCode(res)).toBe('PAYMENT_METHOD_UNAVAILABLE');
      expect(await h.prisma.order.count()).toBe(0);
    });
  });

  describe('webhook: signature + amount + currency validation (AC-2/AC-10)', () => {
    it('a correctly signed payment_intent.succeeded for the right amount/currency confirms, releases files and notifies', async () => {
      const { customer, order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      await h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', intentId)).expect(200);

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it.each([
      ['a validly-signed event for the wrong amount (100 cents)', { amount_received: 100 }],
      ['the old bug value (150,000 cents)', { amount_received: 150000 }],
      ['the right amount in the wrong currency (eur)', { currency: 'eur' }],
      ['a partial amount received (538 of 539)', { amount_received: 538 }],
    ])('%s does NOT confirm the order, release files or notify', async (_label, over) => {
      const { customer, order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      await h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', intentId, over)).expect(200);

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(0);
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      expect(await h.notifCount(customer, 'payment_received')).toBe(0);

      // The rejected event does not poison the order.
      await h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', intentId)).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_confirmed');
    });

    it('an intent that is not the one created for this order is rejected (metadata alone is not enough)', async () => {
      const { order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      const forged = h.stripe.eventPayload('payment_intent.succeeded', intentId, { id: 'pi_someone_elses', metadata: { orderId: order.id } });
      await h.postStripeWebhook(forged).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });

    it('a Stripe event for an order that pays another way is rejected', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const payload = JSON.stringify({ id: 'evt_x', object: 'event', type: 'payment_intent.succeeded', data: { object: { id: 'pi_x', amount: 539, amount_received: 539, currency: 'usd', metadata: { orderId: order.id } } } });
      await h.postStripeWebhook(payload).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });

    it('bad signature (wrong secret / tampered body / missing header) -> 422 INVALID_WEBHOOK_SIGNATURE, order untouched', async () => {
      const { order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      const payload = h.stripe.eventPayload('payment_intent.succeeded', intentId);

      const wrongSecret = await h.postStripeWebhook(payload, { secret: 'whsec_WRONG' });
      expect(wrongSecret.status).toBe(422);
      expect(h.errCode(wrongSecret)).toBe('INVALID_WEBHOOK_SIGNATURE');

      const header = h.stripe.signature(payload);
      const tampered = await h.postStripeWebhook(payload.replace('"amount_received":539', '"amount_received":1'), { header });
      expect(tampered.status).toBe(422);

      const missing = await h.postStripeWebhook(payload, { header: null });
      expect(missing.status).toBe(422);

      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });

    it('other event types (payment_failed, canceled) are acknowledged but never confirm', async () => {
      const { order, intentId } = await stripeOrder();
      for (const type of ['payment_intent.payment_failed', 'payment_intent.canceled', 'payment_intent.processing']) {
        await h.postStripeWebhook(h.stripe.eventPayload(type, intentId)).expect(200);
      }
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });
  });

  describe('server-side verification after the customer returns from the Payment Element (AC-10)', () => {
    it('requires_action (3-D Secure not finished) confirms nothing; succeeded confirms; a repeat is harmless', async () => {
      const { customer, order, intentId } = await stripeOrder();

      h.stripe.setStatus(intentId, 'requires_action');
      const pending = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
      expect(pending.body.data.status).toBe('payment_pending');
      expect(await h.filesStatus(customer, order.id)).toBe(422);

      h.stripe.succeed(intentId);
      const done = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
      expect(done.body.data).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
      expect(await h.filesStatus(customer, order.id)).toBe(200);

      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it('a succeeded intent for the wrong amount or currency is NOT confirmed (409 PAYMENT_AMOUNT_MISMATCH)', async () => {
      for (const over of [{ amount_received: 100 }, { currency: 'eur' }]) {
        await h.reset();
        const { customer, order, intentId } = await stripeOrder();
        h.stripe.succeed(intentId, over);
        const res = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
        expect(res.status).toBe(409);
        expect(h.errCode(res)).toBe('PAYMENT_AMOUNT_MISMATCH');
        expect((await h.orderRow(order.id)).status).toBe('payment_pending');
      }
    });

    it('a cancelled order is never confirmed by a late successful payment', async () => {
      const { customer, order, intentId } = await stripeOrder();
      const admin = await h.mkUser('admin');
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
      h.stripe.succeed(intentId);

      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(409);
      await h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', intentId)).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('cancelled');
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(0);
    });

    it('only the owner can verify', async () => {
      const { order } = await stripeOrder();
      const other = await h.mkUser('customer');
      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(other)).expect(404);
    });
  });

  describe('duplicate payment events are idempotent', () => {
    it('a replayed webhook and simultaneous duplicates confirm exactly once', async () => {
      const { customer, order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      const payload = h.stripe.eventPayload('payment_intent.succeeded', intentId);
      await h.postStripeWebhook(payload).expect(200);
      await Promise.all([1, 2, 3, 4].map(() => h.postStripeWebhook(payload)));

      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.notifCount(customer, 'files_ready')).toBe(1);
      expect(await h.prisma.activityEvent.count({ where: { orderId: BigInt(order.id), eventType: 'PAID' } })).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });

    it('a webhook racing the customer\'s verify call confirms exactly once', async () => {
      const { customer, order, intentId } = await stripeOrder();
      h.stripe.succeed(intentId);
      await Promise.all([
        h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)),
        h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', intentId)),
        h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)),
      ]);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });
  });
});
