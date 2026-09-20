/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, tinyPng, type OrdersHarness } from '../apps/api/test/integration/helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md §6's e2e row — BANK TRANSFER ONLY: "full
// bank-transfer purchase -> receipt -> admin confirms -> files downloadable", credits, and the
// credit-package / subscription purchases that use the same workflow.
// Like this repo's other e2e/*.e2e.spec.ts, this is an API-level walk of each flow — the exact
// sequence of calls apps/web/app/checkout/**, apps/web/app/order-confirmation/** and
// apps/admin/app/{payments,orders,settings}/** make — against a real Postgres, not isolated endpoint tests.
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

  it('Bank transfer: Admin sets the bank details -> checkout (exact PKR) -> payment page -> receipt -> Admin queue + preview -> confirm -> files downloadable', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');

    // /settings/platform (Admin) — the bank account customers pay into.
    const bank = { bankName: 'Habib Bank Limited', accountTitle: 'CZ Digitizing', accountNumber: '0011223344', iban: 'PK36HABB0000001123456702', instructions: 'Use your order reference as the payment note.' };
    await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: true, config: bank }] }).expect(200);

    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);

    // /checkout -> /checkout/bank-transfer/:id
    const order = (await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201)).body.data;
    expect(order.bankTransferReference).toMatch(/^CZD-/);
    expect(order).toMatchObject({ totalPkr: 1500, amountDuePkr: 1500, paymentMethod: 'bank_transfer', status: 'payment_pending' });

    // The payment page: the exact PKR amount + the Admin-configured details, read live.
    expect((await h.http().get('/api/settings/public').expect(200)).body.data.bankTransferConfig).toEqual(bank);
    expect((await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data.amountDuePkr).toBe(1500);

    // Customer uploads the transfer slip.
    const upload = await h.uploadReceipt(customer, order.id, tinyPng(), 'slip.png').expect(201);
    const receiptId = upload.body.data.receipts[0].id;
    expect(await h.filesStatus(customer, order.id)).toBe(422); // uploading a receipt releases nothing

    // /payments (Admin) — the queue shows the order with the customer; /orders/:id previews the file.
    const queue = (await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin)).expect(200)).body.data;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: order.id, customerEmail: customer.email, amountDuePkr: 1500 });
    const preview = await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(admin)).expect(200);
    expect(preview.headers['content-type']).toBe('image/png');

    // Admin confirms; the customer's files unlock and can be downloaded.
    await h.approve(admin, order.id).expect(201);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    await downloadAllFiles(customer, order.id);
    expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(0);
    const history = await h.http().get('/api/orders/user/history').set(h.auth(customer)).expect(200);
    expect(history.body.data.map((o: any) => o.id)).toContain(order.id);
    expect(await h.notifCount(customer, 'payment_received')).toBe(1);
  });

  it('Bank transfer, rejected then corrected: reason shown, new receipt required, same-order re-upload, confirm -> files', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);

    await h.reject(admin, order.id, 'Slip is unreadable').expect(201);
    const seen = (await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data;
    expect(seen.receipts[0]).toMatchObject({ reviewStatus: 'rejected', rejectionReason: 'Slip is unreadable' });
    expect(seen).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await h.filesStatus(customer, order.id)).toBe(422);
    expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Payment receipt rejected — please upload a new one' } }))?.message).toContain('Slip is unreadable');

    await h.uploadReceipt(customer, order.id, tinyPng(), 'clearer-slip.png').expect(201);
    await h.approve(admin, order.id).expect(201);
    await downloadAllFiles(customer, order.id);
  });

  it('Credits: a partly credit-covered order needs a transfer of only the remainder; a fully covered one needs no bank transfer or receipt', async () => {
    const customer = await h.mkUser('customer');
    await h.grantCredits(customer, 2500);

    const partial = await h.checkout(customer, { price: 1500, credits: 500 });
    expect(partial.order).toMatchObject({ status: 'payment_pending', totalPkr: 1500, creditsUsed: 500, amountDuePkr: 1000 });
    expect(partial.order.bankTransferReference).toMatch(/^CZD-/);

    const full = await h.checkout(customer, { price: 1500, credits: 2000 });
    expect(full.order).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed', creditsUsed: 1500, amountDuePkr: 0, bankTransferReference: null });
    await downloadAllFiles(customer, full.order.id);
    expect(h.errCode(await h.uploadReceipt(customer, full.order.id))).toBe('ORDER_ALREADY_CONFIRMED');
    // 2,500 granted − 500 (partial order) − 1,500 (full order; 2,000 offered, 1,500 needed) = 500 left
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(500);
  });

  it('Credit package: buy -> bank details -> receipt -> Admin approves -> credits added and spendable at checkout', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const pkg = await h.mkPackage({ credits: 1400, bonusCredits: 100, pricePkr: 1000 });

    const order = (await h.http().post('/api/credits/purchase').set(h.auth(customer)).send({ packageId: pkg.id.toString() }).expect(201)).body.data;
    expect(order).toMatchObject({ paymentMethod: 'bank_transfer', totalPkr: 1000, amountDuePkr: 1000, status: 'payment_pending' });
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(0);

    await h.uploadReceipt(customer, order.id).expect(201);
    await h.approve(admin, order.id).expect(201);
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(1500);

    // ...and the new credits pay for a design order in full: no bank transfer needed.
    const spent = await h.checkout(customer, { price: 1500, credits: 1500 });
    expect(spent.order).toMatchObject({ status: 'payment_confirmed', amountDuePkr: 0 });
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(0);
  });

  it('Subscription: subscribe -> receipt -> Admin approves -> active with monthly credits; a due renewal is a bank-transfer order too', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const plan = await h.mkPlan({ pricePkr: 2000, monthlyCredits: 100 });

    const order = (await h.http().post('/api/subscriptions/subscribe').set(h.auth(customer)).send({ planId: plan.id.toString() }).expect(201)).body.data;
    await h.http().get('/api/subscriptions/current').set(h.auth(customer)).expect(404);
    await h.uploadReceipt(customer, order.id).expect(201);
    await h.approve(admin, order.id).expect(201);
    expect((await h.http().get('/api/subscriptions/current').set(h.auth(customer)).expect(200)).body.data.status).toBe('active');
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(100);

    // Renewal falls due: an order tagged "renewal" for the exact PKR plan price.
    await h.prisma.customerSubscription.update({ where: { customerId: customer.id }, data: { renewalDate: new Date(Date.now() - 60_000) } });
    await h.services.purchases.attemptRenewal(await h.prisma.customerSubscription.findUniqueOrThrow({ where: { customerId: customer.id }, include: { plan: true } }));
    const renewal = await h.prisma.order.findFirstOrThrow({ where: { customerId: customer.id, transactionType: 'renewal' } });
    expect(Number(renewal.totalPkr)).toBe(2000);
    await h.uploadReceipt(customer, renewal.id.toString()).expect(201);
    await h.approve(admin, renewal.id.toString()).expect(201);
    expect((await h.services.credits.getBalance(customer.id)).available).toBe(200);
  });
});
