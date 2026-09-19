/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, tinyPng, type OrdersHarness } from '../apps/api/test/integration/helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md §6's e2e row: "full PayPal purchase -> files
// downloadable; full bank-transfer purchase -> receipt upload -> admin confirms -> files downloadable".
// Like this repo's other e2e/*.e2e.spec.ts, this is an API-level walk of each flow — the exact
// sequence of calls apps/web/app/checkout/**, apps/web/app/order-confirmation/** and
// apps/admin/app/{payments,orders}/** make — against a real Postgres, not isolated endpoint tests.
// PayPal/Stripe network calls are scripted (FakePayPal/FakeStripe: no real sandbox credentials exist
// in this repo); Stripe webhook signatures use the real Stripe SDK.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise). The repo root has no jest of its
// own, so run apps/api's (from the repo root):
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_test \
//     node apps/api/node_modules/jest/bin/jest.js --config e2e/jest.config.js orders-payment
// App boot (Nest compile + Prisma) can exceed the 15s default when the machine is busy.
jest.setTimeout(60_000);

describe('Orders & payment end-to-end flows (docs/specs/2026-08-28-08-orders-payment-processing.md)', () => {
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

  // The customer's order-confirmation page: list the files, then request a download for each.
  async function downloadAllFiles(customer: any, orderId: string) {
    const files = (await h.http().get(`/api/orders/${orderId}/files`).set(h.auth(customer)).expect(200)).body.data;
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const dl = await h.http().post(`/api/orders/${orderId}/files/${file.id}/download`).set(h.auth(customer)).expect(200);
      expect(dl.body.data.downloadUrl).toBeTruthy();
    }
  }

  it('PayPal: cart -> checkout -> PayPal approval -> return -> server verifies -> files downloadable', async () => {
    const customer = await h.mkUser('customer');
    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);

    // /checkout — customer picks PayPal and places the order.
    const checkout = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'paypal' }).expect(201);
    const order = checkout.body.data;
    expect(order.payment.approveUrl).toContain('https://paypal.fake/approve/');
    expect(order.payment).toMatchObject({ currency: 'USD', amount: '5.39' });

    // /checkout/pay/:id — the page asks for a session (reload-safe), then sends the buyer to PayPal.
    const session = await h.http().post(`/api/orders/${order.id}/payment-session`).set(h.auth(customer)).expect(200);
    expect(session.body.data.approveUrl).toBe(order.payment.approveUrl);
    expect(await h.filesStatus(customer, order.id)).toBe(422); // nothing released before payment

    // The buyer approves on PayPal, PayPal redirects back to /checkout/pay/:id?paypal=return, which
    // calls verify-payment; the server captures and confirms.
    h.paypal.approve('PP-ORDER-1');
    const verified = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
    expect(verified.body.data).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });

    // /order-confirmation/:id — files listed and downloadable; history shows the order.
    await downloadAllFiles(customer, order.id);
    const history = await h.http().get('/api/orders/user/history').set(h.auth(customer)).expect(200);
    expect(history.body.data.map((o: any) => o.id)).toContain(order.id);
    expect(await h.notifCount(customer, 'payment_received')).toBe(1);
  });

  it('Card (Stripe): cart -> checkout -> client secret -> card charged -> webhook -> files downloadable', async () => {
    const customer = await h.mkUser('customer');
    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);

    const checkout = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'stripe' }).expect(201);
    const order = checkout.body.data;
    expect(order.payment).toMatchObject({ provider: 'stripe', clientSecret: 'pi_test_1_secret_test', amountMinor: 539, currency: 'USD' });
    expect(await h.filesStatus(customer, order.id)).toBe(422);

    // The Payment Element charges the card (3-D Secure handled in the browser by Stripe); Stripe then
    // POSTs a signed payment_intent.succeeded webhook.
    h.stripe.succeed('pi_test_1');
    await h.postStripeWebhook(h.stripe.eventPayload('payment_intent.succeeded', 'pi_test_1')).expect(200);

    // The browser returns to /order-confirmation/:id, which asks the server to verify (a no-op now).
    const after = await h.http().post(`/api/orders/${order.id}/verify-payment`).set(h.auth(customer)).expect(200);
    expect(after.body.data.status).toBe('payment_confirmed');
    await downloadAllFiles(customer, order.id);
    expect(await h.notifCount(customer, 'payment_received')).toBe(1);
  });

  it('Bank transfer: checkout -> receipt upload -> Admin queue + preview -> confirm -> files downloadable', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);

    // /checkout -> /checkout/bank-transfer/:id
    const order = (await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201)).body.data;
    expect(order.bankTransferReference).toMatch(/^CZD-/);
    expect(order.amountDuePkr).toBe(1500);

    // Customer uploads the transfer slip.
    const upload = await h.uploadReceipt(customer, order.id, tinyPng(), 'slip.png').expect(201);
    const receiptId = upload.body.data.receipts[0].id;
    expect(await h.filesStatus(customer, order.id)).toBe(422);

    // /payments (Admin) — the queue shows the order with the customer; /orders/:id previews the file.
    const queue = (await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin)).expect(200)).body.data;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: order.id, customerEmail: customer.email, amountDuePkr: 1500 });
    const preview = await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(admin)).expect(200);
    expect(preview.headers['content-type']).toBe('image/png');

    // Admin confirms; the customer's files unlock and can be downloaded.
    await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
    await downloadAllFiles(customer, order.id);
    expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(0);
  });

  it('Bank transfer, rejected then corrected: reason shown, same-order re-upload, confirm -> files', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);

    await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: false, rejectionReason: 'Slip is unreadable' }).expect(201);
    const seen = (await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data;
    expect(seen.receipts[0]).toMatchObject({ reviewStatus: 'rejected', rejectionReason: 'Slip is unreadable' });
    expect(await h.filesStatus(customer, order.id)).toBe(422);

    await h.uploadReceipt(customer, order.id, tinyPng(), 'clearer-slip.png').expect(201);
    await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
    await downloadAllFiles(customer, order.id);
  });

  it('Credits: a partly credit-covered PayPal order is charged only the remainder; a fully covered one needs no payment step', async () => {
    const customer = await h.mkUser('customer');
    await h.grantCredits(customer, 2500);

    const partial = await h.checkout(customer, 'paypal', { price: 1500, credits: 500 });
    expect(partial.order.payment).toMatchObject({ currency: 'USD', amount: '3.59' }); // PKR 1,000 due
    expect(partial.order.status).toBe('payment_pending');

    const full = await h.checkout(customer, 'paypal', { price: 1500, credits: 2000 });
    expect(full.order).toMatchObject({ status: 'payment_confirmed', payment: null, creditsUsed: 1500, amountDuePkr: 0 });
    await downloadAllFiles(customer, full.order.id);
    // 2,500 granted − 500 (partial order) − 1,500 (full order; 2,000 offered, 1,500 needed) = 500 left
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(500);
  });
});
