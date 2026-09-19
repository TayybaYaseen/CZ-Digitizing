/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — PayPal: AC-1 (customer
// payment is initiable, server-verified, then confirms + releases files), AC-2 (bad signature),
// and the critical fixes: correct provider amount/currency, webhook amount/currency validation,
// duplicate-event idempotency. PayPal's REST API is scripted (FakePayPal) — see the harness header.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
describe('A-013 PayPal payments', () => {
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

  async function paypalOrder(opts: { price?: number; credits?: number } = {}) {
    const customer = await h.mkUser('customer');
    if (opts.credits) await h.grantCredits(customer, opts.credits);
    const { res, order } = await h.checkout(customer, 'paypal', opts);
    return { customer, res, order, paypalId: `PP-ORDER-${h.paypal.seq}` };
  }

  describe('customer can actually start the payment (AC-1)', () => {
    it('checkout returns the PayPal approval link and the locked charge; PayPal is asked for USD 5.39 — NOT USD 1500.00', async () => {
      const { res, order } = await paypalOrder({ price: 1500 });

      expect(res.status).toBe(201);
      expect(order.payment).toMatchObject({ provider: 'paypal', approveUrl: 'https://paypal.fake/approve/PP-ORDER-1', currency: 'USD', amount: '5.39', amountMinor: 539 });
      // PKR stays the source of truth and the provider amount is traceable to it.
      expect(order.totalPkr).toBe(1500);
      expect(order.providerCharge).toEqual({ currency: 'USD', amount: '5.39', amountMinor: 539, amountPkr: 1500, rateToPkr: 278.5 });

      const create = h.paypal.callsTo('/v2/checkout/orders', 'POST')[0];
      expect(create.body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '5.39' });
      expect(create.body.purchase_units[0].amount.value).not.toBe('1500.00');
      expect(create.body.purchase_units[0].reference_id).toBe(order.id);
      expect(create.body.payment_source.paypal.experience_context.return_url).toContain(`/checkout/pay/${order.id}?paypal=return`);

      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ paypalOrderId: 'PP-ORDER-1', providerCurrency: 'USD', providerAmountMinor: 539, status: 'payment_pending', paymentStatus: 'pending' });
      expect(Number(row.providerRateToPkr)).toBe(278.5);
      expect(Number(row.providerChargePkr)).toBe(1500);
    });

    it('credits reduce what PayPal is asked to collect (1,500 total − 500 credits = PKR 1,000 → USD 3.59)', async () => {
      const { order } = await paypalOrder({ price: 1500, credits: 500 });
      expect(order.creditsUsed).toBe(500);
      expect(order.amountDuePkr).toBe(1000);
      expect(h.paypal.callsTo('/v2/checkout/orders', 'POST')[0].body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '3.59' });
      expect(order.providerCharge).toMatchObject({ amountPkr: 1000, amountMinor: 359 });
    });
  });

  describe('server-side verification — the browser is never trusted (AC-1)', () => {
    it('full flow: not approved -> 409, approved -> server captures, confirms, releases files, notifies once', async () => {
      const { customer, order, paypalId } = await paypalOrder();

      // The customer has NOT approved on PayPal: "I paid" is worthless.
      const early = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
      expect(early.status).toBe(409);
      expect(h.errCode(early)).toBe('PAYMENT_NOT_APPROVED');
      expect(h.paypal.callsTo('/capture')).toHaveLength(0);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
      expect(await h.filesStatus(customer, order.id)).toBe(422);

      // The buyer approves on PayPal, the browser returns, the SERVER captures and verifies.
      h.paypal.approve(paypalId);
      const done = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
      expect(done.status).toBe(200);
      expect(done.body.data).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
      expect(h.paypal.callsTo('/capture', 'POST')).toHaveLength(1);
      expect(h.paypal.callsTo('/capture', 'POST')[0].headers['PayPal-Request-Id']).toBe(`czd-capture-${order.id}`);

      const row = await h.orderRow(order.id);
      expect(row.paypalCaptureId).toBe(`CAP-${paypalId}`);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: row.id } })).toBe(1);
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);

      // Calling it again is harmless: no second capture, no second notification.
      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
      expect(h.paypal.callsTo('/capture', 'POST')).toHaveLength(1);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it('only the owner can verify (other customer 404, admin token on the customer route 403)', async () => {
      const { order } = await paypalOrder();
      const other = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(other)).expect(404);
      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(admin)).expect(403);
    });

    it('a cancelled order is never captured, even if the buyer approved at PayPal', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const admin = await h.mkUser('admin');
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
      h.paypal.approve(paypalId);

      const res = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
      expect(res.status).toBe(409);
      expect(h.errCode(res)).toBe('ORDER_NOT_PAYABLE');
      expect(h.paypal.callsTo('/capture')).toHaveLength(0);
      expect((await h.orderRow(order.id)).status).toBe('cancelled');
    });

    it('a captured amount that does not match the order is NOT confirmed', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      h.paypal.captureOverride = { value: '1.00' };
      h.paypal.approve(paypalId);

      const res = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
      expect(res.status).toBe(409);
      expect(h.errCode(res)).toBe('PAYMENT_AMOUNT_MISMATCH');
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
      expect(await h.filesStatus(customer, order.id)).toBe(422);
    });

    it('a PayPal order whose amount differs from the locked amount is NOT even captured', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      h.paypal.orders.get(paypalId)!.value = '1.00';
      h.paypal.approve(paypalId);

      const res = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer));
      expect(res.status).toBe(409);
      expect(h.errCode(res)).toBe('PAYMENT_AMOUNT_MISMATCH');
      expect(h.paypal.callsTo('/capture')).toHaveLength(0);
    });

    it('Admin can re-check a provider order (missed webhook); a customer cannot use that route', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const admin = await h.mkUser('admin');
      h.paypal.approve(paypalId);
      await h.http().post(`/api/orders/${order.id}/reverify-payment`).set(h.auth(customer)).expect(403);
      const res = await h.http().post(`/api/orders/${order.id}/reverify-payment`).set(h.auth(admin)).expect(200);
      expect(res.body.data.status).toBe('payment_confirmed');
      expect(await h.filesStatus(customer, order.id)).toBe(200);
    });
  });

  describe('webhook: signature + amount + currency validation (AC-1/AC-2)', () => {
    it('correct amount and currency, valid signature -> confirms, releases files, notifies', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId)).expect(200);

      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed', paypalCaptureId: `CAP-${paypalId}` });
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it.each([
      ['a validly-signed event for the wrong amount (USD 1.00)', { value: '1.00' }],
      ['the old bug value (USD 1500.00)', { value: '1500.00' }],
      ['the right number in the wrong currency (EUR 5.39)', { currency: 'EUR' }],
      ['an unparseable amount', { value: '5.399999' }],
      ['a non-COMPLETED capture status', { status: 'PENDING' }],
    ])('%s is acknowledged but does NOT confirm the order, release files, or notify', async (_label, over) => {
      const { customer, order, paypalId } = await paypalOrder();
      await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId, over)).expect(200);

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', paypalCaptureId: null });
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(0);
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      expect(await h.notifCount(customer, 'payment_received')).toBe(0);

      // A rejected event does not poison the order: the genuine event still confirms it.
      await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId)).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_confirmed');
    });

    it('invalid signature -> 422 INVALID_WEBHOOK_SIGNATURE, order untouched, no files (AC-2)', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      h.paypal.signatureValid = false;

      const res = await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId));
      expect(res.status).toBe(422);
      expect(h.errCode(res)).toBe('INVALID_WEBHOOK_SIGNATURE');
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
      expect(await h.filesStatus(customer, order.id)).toBe(422);
    });

    it('an event for an unknown PayPal order is acknowledged and changes nothing', async () => {
      const { order } = await paypalOrder();
      await h.postPaypalWebhook({ id: 'WH-x', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-x', status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.39' }, supplementary_data: { related_ids: { order_id: 'PP-NOPE' } } } }).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });

    it('other event types are acknowledged and ignored', async () => {
      const { order, paypalId } = await paypalOrder();
      await h.postPaypalWebhook({ ...h.paypal.captureCompletedEvent(paypalId), event_type: 'PAYMENT.CAPTURE.DENIED' }).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending');
    });
  });

  describe('duplicate payment events are idempotent', () => {
    it('a replayed valid webhook confirms once: one notification, one PAID activity, one file grant', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const event = h.paypal.captureCompletedEvent(paypalId);
      await h.postPaypalWebhook(event).expect(200);
      await h.postPaypalWebhook(event).expect(200);

      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.notifCount(customer, 'files_ready')).toBe(1);
      expect(await h.prisma.activityEvent.count({ where: { orderId: BigInt(order.id), eventType: 'PAID' } })).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });

    it('simultaneous duplicate webhooks (a provider retry storm) still confirm exactly once', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const event = h.paypal.captureCompletedEvent(paypalId);
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => h.postPaypalWebhook(event)));
      results.forEach((r) => expect(r.status).toBe(200));

      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.notifCount(customer, 'files_ready')).toBe(1);
      expect(await h.prisma.activityEvent.count({ where: { orderId: BigInt(order.id), eventType: 'PAID' } })).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });

    it('a webhook racing the customer\'s own verify call still confirms exactly once', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      h.paypal.approve(paypalId);
      await Promise.all([
        h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)),
        h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId)),
        h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)),
      ]);
      expect((await h.orderRow(order.id)).status).toBe('payment_confirmed');
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });
  });

  describe('failure handling — never an unpayable dead-end', () => {
    it('provider not configured -> 503 PAYMENT_METHOD_UNAVAILABLE, no order created, cart kept', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign();
      await h.addToCart(customer, design, size);
      jest.spyOn(h.services.paypalService, 'canCreatePayments').mockReturnValueOnce(false);

      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'paypal' });
      expect(res.status).toBe(503);
      expect(h.errCode(res)).toBe('PAYMENT_METHOD_UNAVAILABLE');
      expect(await h.prisma.order.count()).toBe(0);
      expect((await h.http().get('/api/cart').set(h.auth(customer))).body.data.items).toHaveLength(1);
    });

    it('no exchange rate on file -> 503 PAYMENT_CURRENCY_UNAVAILABLE (never a guessed rate), no order created', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign();
      await h.addToCart(customer, design, size);
      await h.prisma.exchangeRate.deleteMany();

      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'paypal' });
      expect(res.status).toBe(503);
      expect(h.errCode(res)).toBe('PAYMENT_CURRENCY_UNAVAILABLE');
      expect(await h.prisma.order.count()).toBe(0);
      expect(h.paypal.callsTo('/v2/checkout/orders', 'POST')).toHaveLength(0);
    });

    it('a stale exchange rate is refused too', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign();
      await h.addToCart(customer, design, size);
      await h.prisma.$executeRawUnsafe(`UPDATE exchange_rates SET updated_at = now() - interval '3 days' WHERE currency_code = 'USD'`);

      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'paypal' });
      expect(res.status).toBe(503);
      expect(h.errCode(res)).toBe('PAYMENT_CURRENCY_UNAVAILABLE');
    });

    it('PayPal down at checkout: the order exists (payment_pending, no dead end) and payment-session retries once PayPal recovers', async () => {
      h.paypal.failCreate = true;
      const customer = await h.mkUser('customer');
      const { res, order } = await h.checkout(customer, 'paypal');
      expect(res.status).toBe(201);
      expect(order.payment).toBeNull();
      expect(order.status).toBe('payment_pending');
      expect((await h.orderRow(order.id)).paypalOrderId).toBeNull();

      h.paypal.failCreate = false;
      const retry = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(retry.body.data).toMatchObject({ provider: 'paypal', currency: 'USD', amount: '5.39', approveUrl: expect.stringContaining('https://paypal.fake/approve/') });
      // The retry re-uses the amount locked at checkout.
      expect(h.paypal.callsTo('/v2/checkout/orders', 'POST').pop()!.body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '5.39' });

      h.paypal.approve(`PP-ORDER-${h.paypal.seq}`);
      await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_confirmed');
    });

    it('payment-session re-uses the live PayPal order instead of creating a second one', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const again = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(again.body.data.approveUrl).toBe(`https://paypal.fake/approve/${paypalId}`);
      expect(h.paypal.callsTo('/v2/checkout/orders', 'POST')).toHaveLength(1);
    });

    it('payment-session: paid order 409, other customer 404, bank-transfer order 400', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      const other = await h.mkUser('customer');
      const bank = await h.checkout(customer, 'bank_transfer');
      await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(other)).expect(404);
      await h.http().post(`/api/orders/${bank.order.id}/payment-session`).set(h.auth(customer)).expect(400);

      await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId)).expect(200);
      const paid = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer));
      expect(paid.status).toBe(409);
      expect(h.errCode(paid)).toBe('ORDER_ALREADY_CONFIRMED');
    });

    it('an old provider order with no locked amount is fail-closed for webhooks, and payment-session re-locks it at the current rate', async () => {
      const { customer, order, paypalId } = await paypalOrder();
      await h.prisma.order.update({ where: { id: BigInt(order.id) }, data: { providerCurrency: null, providerAmountMinor: null, providerRateToPkr: null, providerChargePkr: null } });

      await h.postPaypalWebhook(h.paypal.captureCompletedEvent(paypalId)).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('payment_pending'); // nothing to compare against -> refuse

      await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
      expect(await h.orderRow(order.id)).toMatchObject({ providerCurrency: 'USD', providerAmountMinor: 539 });
    });
  });
});
