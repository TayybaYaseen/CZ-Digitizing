/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, tinyPdf, tinyPng, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — everything that is not
// provider-specific: bank transfer + receipt review (AC-3/AC-4/AC-5), files blocked until paid
// (AC-6), order history (AC-7), currency display (AC-8), settings (AC-9), credits interacting with
// the amount due, the payment-bypass / cancelled-order state guards, duplicate checkout, and
// refunds not regressing. PayPal: paypal-payments.spec.ts, Stripe: stripe-payments.spec.ts.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_test pnpm --filter @czd/api test:integration -- orders
describe('A-013 Orders & Payment Processing', () => {
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

  const binary = (res: any, cb: (err: Error | null, body: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  describe('AC-3 bank transfer checkout', () => {
    it('creates a payment_pending order with a unique CZD-XXXX-XXXX reference and clears the active cart', async () => {
      const customer = await h.mkUser('customer');
      const a = await h.checkout(customer, 'bank_transfer');
      const b = await h.checkout(customer, 'bank_transfer');

      expect(a.res.status).toBe(201);
      expect(a.order).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', amountDuePkr: 1500, payment: null, providerCharge: null });
      expect(a.order.bankTransferReference).toMatch(/^CZD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(a.order.bankTransferReference).not.toBe(b.order.bankTransferReference);
      expect((await h.http().get('/api/cart').set(h.auth(customer))).body.data.items).toHaveLength(0);
    });

    it('order price is a snapshot: a later catalog price change does not alter the order', async () => {
      const customer = await h.mkUser('customer');
      const { order, design } = await h.checkout(customer, 'bank_transfer', { price: 1500 });
      await h.prisma.design.update({ where: { id: design.id }, data: { pricePkr: 9999 } });
      expect((await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data.totalPkr).toBe(1500);
    });

    it('an empty cart cannot be checked out', async () => {
      const customer = await h.mkUser('customer');
      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' });
      expect(res.status).toBe(400);
      expect(await h.prisma.order.count()).toBe(0);
    });
  });

  describe('AC-4 receipt upload (safe file types only)', () => {
    it('accepts PNG, JPEG and PDF; records the DETECTED content type; notifies every admin', async () => {
      const customer = await h.mkUser('customer');
      const admin1 = await h.mkUser('admin');
      const admin2 = await h.mkUser('admin');
      const png = await h.checkout(customer, 'bank_transfer');
      const pdf = await h.checkout(customer, 'bank_transfer');
      const jpg = await h.checkout(customer, 'bank_transfer');

      const up1 = await h.uploadReceipt(customer, png.order.id).expect(201);
      expect(up1.body.data.receipts[0]).toMatchObject({ reviewStatus: 'pending', contentType: 'image/png', originalFilename: 'receipt.png' });
      await h.uploadReceipt(customer, pdf.order.id, tinyPdf(), 'slip.pdf').expect(201);
      await h.uploadReceipt(customer, jpg.order.id, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]), 'slip.jpeg').expect(201);

      expect(await h.notifCount(admin1, 'receipt_uploaded')).toBe(3);
      expect(await h.notifCount(admin2, 'receipt_uploaded')).toBe(3);
    });

    it('rejects executables, HTML, SVG, text and archives (415), whatever their name or declared type', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const samples: [string, Buffer][] = [
        ['malware.exe', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)])],
        ['receipt.png', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)])], // exe disguised as a PNG
        ['page.html', Buffer.from('<html><script>alert(1)</script></html>')],
        ['image.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')],
        ['notes.txt', Buffer.from('this is a receipt, trust me, really it is')],
        ['bundle.zip', Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)])],
      ];
      for (const [name, bytes] of samples) {
        const res = await h.uploadReceipt(customer, order.id, bytes, name);
        expect([name, res.status, h.errCode(res)]).toEqual([name, 415, 'UNSUPPORTED_FILE_TYPE']);
      }
      expect(await h.prisma.paymentReceipt.count()).toBe(0);
    });

    it('rejects a file over 10 MB', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const res = await h.uploadReceipt(customer, order.id, Buffer.concat([tinyPng(), Buffer.alloc(11 * 1024 * 1024)]), 'big.png');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await h.prisma.paymentReceipt.count()).toBe(0);
    });

    it('only the owner of a bank-transfer order can upload (other customer 404, PayPal order 400, no file 422)', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const bank = await h.checkout(customer, 'bank_transfer');
      const paypal = await h.checkout(customer, 'paypal');
      await h.uploadReceipt(other, bank.order.id).expect(404);
      await h.uploadReceipt(customer, paypal.order.id).expect(400);
      const noFile = await h.http().post(`/api/orders/${bank.order.id}/receipt`).set(h.auth(customer));
      expect(noFile.status).toBe(422);
      expect(h.errCode(noFile)).toBe('RECEIPT_REQUIRED');
    });

    it('only one receipt can await review at a time (409 RECEIPT_ALREADY_PENDING), incl. simultaneous uploads', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const results = await Promise.all([1, 2, 3].map(() => h.uploadReceipt(customer, order.id)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
      expect(await h.prisma.paymentReceipt.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
      const again = await h.uploadReceipt(customer, order.id);
      expect(h.errCode(again)).toBe('RECEIPT_ALREADY_PENDING');
    });
  });

  describe('AC-4/AC-5 Admin receipt queue and preview', () => {
    it('the queue lists only orders awaiting payment with a pending receipt, with customer identity, oldest first', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const withReceipt1 = await h.bankOrderWithReceipt(customer);
      const withReceipt2 = await h.bankOrderWithReceipt(other);
      await h.checkout(customer, 'bank_transfer'); // no receipt -> not in the queue
      await h.checkout(customer, 'paypal'); // not bank transfer -> not in the queue

      const res = await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin)).expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.map((o: any) => o.id)).toEqual([withReceipt1.id, withReceipt2.id]);
      expect(res.body.data[0]).toMatchObject({
        customerEmail: customer.email,
        paymentMethod: 'bank_transfer',
        amountDuePkr: 1500,
        bankTransferReference: withReceipt1.bankTransferReference,
        latestReceipt: { reviewStatus: 'pending', contentType: 'image/png' },
      });
    });

    it('Admin can open the receipt file (right type, no-sniff, private) and reviews it before approving', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const up = await h.uploadReceipt(customer, order.id, tinyPng(), 'my slip.png').expect(201);
      const receiptId = up.body.data.receipts[0].id;

      const res = await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(admin)).buffer(true).parse(binary);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['content-disposition']).toContain(`receipt-${receiptId}.png`);
      expect(Buffer.compare(res.body as Buffer, tinyPng())).toBe(0);

      const pdfOrder = await h.checkout(customer, 'bank_transfer');
      const pdfUp = await h.uploadReceipt(customer, pdfOrder.order.id, tinyPdf(), 'slip.pdf').expect(201);
      const pdfRes = await h.http().get(`/api/orders/${pdfOrder.order.id}/receipts/${pdfUp.body.data.receipts[0].id}/file`).set(h.auth(admin)).buffer(true).parse(binary);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
    });

    it('the receipt file is never public: anonymous 401, customers (even the owner) 403, wrong order/receipt id 404', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const other = await h.checkout(customer, 'bank_transfer');
      const up = await h.uploadReceipt(customer, order.id).expect(201);
      const receiptId = up.body.data.receipts[0].id;
      const url = `/api/orders/${order.id}/receipts/${receiptId}/file`;

      await h.http().get(url).expect(401);
      await h.http().get(url).set(h.auth(customer)).expect(403);
      await h.http().get(`/api/orders/${other.order.id}/receipts/${receiptId}/file`).set(h.auth(admin)).expect(404);
      await h.http().get(`/api/orders/${order.id}/receipts/999999/file`).set(h.auth(admin)).expect(404);
      await h.http().get(`/api/orders/${order.id}/receipts/not-a-number/file`).set(h.auth(admin)).expect(404);
    });

    it('a stored file that no longer passes the type check is never served', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const up = await h.uploadReceipt(customer, order.id, Buffer.concat([tinyPng(), Buffer.from(`unique-${Date.now()}`)])).expect(201);
      const receiptId = up.body.data.receipts[0].id;
      const receipt = await h.prisma.paymentReceipt.findUniqueOrThrow({ where: { id: BigInt(receiptId) } });
      require('fs').writeFileSync(receipt.fileUrl, Buffer.from('<script>alert(1)</script>'));
      const res = await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(admin));
      expect(res.status).toBe(415);
    });
  });

  describe('AC-5 Admin confirms or rejects', () => {
    it('approve: payment_confirmed, files released, customer notified once, leaves the queue', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      expect(await h.filesStatus(customer, order.id)).toBe(422); // AC-6: blocked before approval

      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(0);
      const audit = await h.prisma.auditLog.findFirst({ where: { actionType: 'ORDER_RECEIPT_APPROVED', resourceId: order.id } });
      expect(audit?.adminUserId).toBe(admin.id);

      // duplicate approval
      const again = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(again.status).toBe(409);
      expect(h.errCode(again)).toBe('ORDER_ALREADY_CONFIRMED');
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      // late upload
      expect(h.errCode(await h.uploadReceipt(customer, order.id))).toBe('ORDER_ALREADY_CONFIRMED');
    });

    it('two admins approving at the same instant confirm exactly once', async () => {
      const customer = await h.mkUser('customer');
      const admin1 = await h.mkUser('admin');
      const admin2 = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      const results = await Promise.all([
        h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin1)).send({ approve: true }),
        h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin2)).send({ approve: true }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });

    it('reject: reason shown to the customer, no files, order stays payment_pending; same-order re-upload then approval works', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);

      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: false, rejectionReason: 'Amount does not match' }).expect(201);

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Receipt rejected' } }))?.message).toContain('Amount does not match');
      const dto = (await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer))).body.data;
      expect(dto.receipts[0]).toMatchObject({ reviewStatus: 'rejected', rejectionReason: 'Amount does not match' });
      expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(0);

      // Re-approving the SAME (already-rejected) receipt is refused — a new one is needed.
      const stale = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(stale.status).toBe(422);
      expect(h.errCode(stale)).toBe('RECEIPT_REQUIRED');

      await h.uploadReceipt(customer, order.id, tinyPdf(), 'corrected.pdf').expect(201);
      expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(1);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      expect(await h.filesStatus(customer, order.id)).toBe(200);
    });

    it('confirmation with no receipt on file -> 422 RECEIPT_REQUIRED', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer, 'bank_transfer');
      const res = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(res.status).toBe(422);
      expect(h.errCode(res)).toBe('RECEIPT_REQUIRED');
    });

    it('a PayPal/Stripe order has no receipt to review (400)', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer, 'paypal');
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(400);
    });
  });

  describe('a cancelled order can never be resurrected by a receipt', () => {
    it('cancelled + receipt approval = NOT payment_confirmed; no files, no credits/notifications for the invalid transition', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer); // receipt uploaded, awaiting review
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);

      const res = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(res.status).toBe(409);
      expect(h.errCode(res)).toBe('ORDER_NOT_PAYABLE');

      expect(await h.orderRow(order.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(0);
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      expect(await h.notifCount(customer, 'payment_received')).toBe(0);
      expect(await h.prisma.activityEvent.count({ where: { orderId: BigInt(order.id), eventType: 'PAID' } })).toBe(0);
      // and the receipt was not consumed by the refused approval
      expect((await h.prisma.paymentReceipt.findFirstOrThrow({ where: { orderId: BigInt(order.id) } })).reviewStatus).toBe('pending');
    });

    it('cancelled orders cannot take a new receipt, and rejecting on a cancelled order is refused too', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
      const up = await h.uploadReceipt(customer, order.id);
      expect(up.status).toBe(409);
      expect(h.errCode(up)).toBe('ORDER_NOT_PAYABLE');
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: false, rejectionReason: 'x' }).expect(409);
      // a cancelled order is out of the review queue
      expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(0);
    });

    it('a refunded order cannot be revived either', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);
      expect((await h.orderRow(order.id)).status).toBe('refunded');
      const res = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(res.status).toBe(409);
      expect((await h.orderRow(order.id)).status).toBe('refunded');
    });
  });

  describe('Admin status changes can never simulate a payment', () => {
    it('payment_confirmed via PUT /status is refused for every payment method and leaves the order unpaid', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const bankNoReceipt = await h.checkout(customer, 'bank_transfer');
      const bankWithReceipt = await h.bankOrderWithReceipt(customer);
      const paypal = await h.checkout(customer, 'paypal');
      const stripe = await h.checkout(customer, 'stripe');

      const noReceipt = await h.http().put(`/api/orders/${bankNoReceipt.order.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect([noReceipt.status, h.errCode(noReceipt)]).toEqual([422, 'RECEIPT_REQUIRED']);

      for (const id of [bankWithReceipt.id, paypal.order.id, stripe.order.id]) {
        const res = await h.http().put(`/api/orders/${id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
        expect([id, res.status, h.errCode(res)]).toEqual([id, 409, 'PAYMENT_CONFIRMATION_REQUIRED']);
      }

      for (const id of [bankNoReceipt.order.id, bankWithReceipt.id, paypal.order.id, stripe.order.id]) {
        expect(await h.orderRow(id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
        expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(id) } })).toBe(0);
        expect(await h.filesStatus(customer, id)).toBe(422);
      }
      expect(await h.notifCount(customer, 'payment_received')).toBe(0);
    });

    it('moving an already-paid order to payment_confirmed again is ORDER_ALREADY_CONFIRMED', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      const res = await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect([res.status, h.errCode(res)]).toEqual([409, 'ORDER_ALREADY_CONFIRMED']);
    });

    it('refunded via PUT /status is refused (use the refund action, which also updates the payment status)', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      const res = await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'refunded' });
      expect([res.status, h.errCode(res)]).toEqual([409, 'USE_REFUND_ENDPOINT']);
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    });

    it('legitimate manual transitions still work: processing -> ready -> completed, cancel from payment_pending; illegal jumps are 409', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const put = (id: string, status: string) => h.http().put(`/api/orders/${id}/status`).set(h.auth(admin)).send({ status });

      const order = await h.bankOrderWithReceipt(customer);
      const jump = await put(order.id, 'completed');
      expect([jump.status, h.errCode(jump)]).toEqual([409, 'INVALID_ORDER_TRANSITION']);

      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await put(order.id, 'processing').expect(200);
      await put(order.id, 'ready').expect(200);
      await put(order.id, 'completed').expect(200);
      expect(await h.filesStatus(customer, order.id)).toBe(200); // AC-6: still reachable once completed
      expect((await put(order.id, 'cancelled')).status).toBe(409);
      expect(await h.prisma.notification.count({ where: { recipientUserId: customer.id, notificationType: 'order_status_change' } })).toBeGreaterThanOrEqual(3);

      const other = await h.checkout(customer, 'bank_transfer');
      await put(other.order.id, 'cancelled').expect(200);
      expect((await h.orderRow(other.order.id)).status).toBe('cancelled');
    });

    it('two simultaneous manual transitions cannot both apply', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      const results = await Promise.all([
        h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'processing' }),
        h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'processing' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe('credits and the amount due (AC-7 subscriptions-credits spec)', () => {
    it('5,000 credits against a Rs 1,500 order consume only 1,500 and leave 3,500', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { res, order } = await h.checkout(customer, 'paypal', { price: 1500, credits: 5000 });

      expect(res.status).toBe(201);
      expect(order).toMatchObject({ totalPkr: 1500, creditsUsed: 1500, amountDuePkr: 0 });
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(3500);
      expect((await h.services.credits.getBalance(customer.id)).used).toBe(1500);
    });

    it('a fully credit-covered order is paid at once: no PayPal/Stripe call, files released, no receipt requested', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, 'paypal', { credits: 5000 });

      expect(order).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed', payment: null, providerCharge: null });
      expect(h.paypal.callsTo('/v2/checkout/orders', 'POST')).toHaveLength(0);
      expect(h.stripe.createCalls).toHaveLength(0);
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it('a fully credit-covered BANK-TRANSFER order gets no reference, nothing to transfer, and no receipt is accepted', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, 'bank_transfer', { credits: 5000 });

      expect(order).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed', bankTransferReference: null, amountDuePkr: 0, creditsUsed: 1500 });
      expect(await h.notifCount(customer, 'order_confirmed')).toBe(0); // not "awaiting payment"
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      const up = await h.uploadReceipt(customer, order.id);
      expect([up.status, h.errCode(up)]).toEqual([409, 'ORDER_ALREADY_CONFIRMED']);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(3500);
    });

    it('a partly credit-covered bank-transfer order shows only what is still owed', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 500);
      const { order } = await h.checkout(customer, 'bank_transfer', { credits: 500 });
      expect(order).toMatchObject({ totalPkr: 1500, creditsUsed: 500, amountDuePkr: 1000, status: 'payment_pending' });
      expect(order.bankTransferReference).toMatch(/^CZD-/);
    });

    it('POST /api/cart/credits reports the capped amount (what checkout would actually use)', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const res = await h.http().post('/api/cart/credits').set(h.auth(customer)).send({ amountPkr: 5000 }).expect(200);
      expect(res.body.data.creditsUsed).toBe(1500);
    });

    it('insufficient balance for the capped amount -> 422 INSUFFICIENT_CREDITS, nothing consumed, cart kept', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 800);
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer', creditsToApplyPkr: 5000 });
      expect([res.status, h.errCode(res)]).toEqual([422, 'INSUFFICIENT_CREDITS']);
      expect(await h.prisma.order.count()).toBe(0);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(800);
      expect((await h.http().get('/api/cart').set(h.auth(customer))).body.data.items).toHaveLength(1);
    });

    it('a full refund of a credit-covered order gives back exactly the credits it used', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, 'bank_transfer', { credits: 5000 });
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(3500);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(5000);
    });
  });

  describe('duplicate checkout protection', () => {
    it('simultaneous checkouts of one cart create exactly one order (the losers get 409 CART_CHANGED)', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const results = await Promise.all([1, 2, 3, 4].map(() => h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' })));

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const losers = results.filter((r) => r.status !== 201);
      expect(losers).toHaveLength(3);
      // A loser either lost the lock race (409 CART_CHANGED) or arrived after the cart was already
      // emptied (400 empty cart) — both are a refusal, never a second order.
      losers.forEach((r) => expect([[409, 'CART_CHANGED'], [400, 'VALIDATION_ERROR']]).toContainEqual([r.status, h.errCode(r)]));
      expect(await h.prisma.order.count()).toBe(1);
      expect(await h.prisma.orderItem.count()).toBe(1);
      expect((await h.http().get('/api/cart').set(h.auth(customer))).body.data.items).toHaveLength(0);
    });

    it('simultaneous checkouts that apply credits can never spend the same credits twice', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 1500);
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const results = await Promise.all([1, 2, 3].map(() => h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer', creditsToApplyPkr: 1500 })));

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await h.prisma.order.count()).toBe(1);
      const balance = await h.services.credits.getBalance(customer.id);
      expect(balance.available).toBe(0);
      expect(balance.used).toBe(1500);
    });

    it('a repeat checkout after the cart was already turned into an order creates nothing', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const first = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' });
      expect(first.status).toBe(201);
      const second = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' });
      expect(second.status).toBe(400); // empty cart
      expect(await h.prisma.order.count()).toBe(1);
    });
  });

  describe('AC-6 files blocked until paid', () => {
    it('unpaid orders of every method have files blocked (422); a paid order allows a download token; a full refund blocks it again', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      for (const method of ['paypal', 'stripe', 'bank_transfer'] as const) {
        const { order } = await h.checkout(customer, method);
        expect([method, await h.filesStatus(customer, order.id)]).toEqual([method, 422]);
      }

      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      const files = (await h.http().get(`/api/orders/${order.id}/files`).set(h.auth(customer)).expect(200)).body.data;
      const dl = await h.http().post(`/api/orders/${order.id}/files/${files[0].id}/download`).set(h.auth(customer));
      expect(dl.status).toBe(200);
      expect(dl.body.data.downloadUrl).toBeTruthy();

      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);
      expect((await h.http().post(`/api/orders/${order.id}/files/${files[0].id}/download`).set(h.auth(customer))).status).toBe(422);
    });
  });

  describe('AC-7 order history and access control', () => {
    it('history accumulates every purchase (all methods), newest first, scoped to the customer, paginated', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const a = await h.checkout(customer, 'bank_transfer', { price: 1000 });
      const b = await h.checkout(customer, 'paypal', { price: 2000 });
      await h.checkout(other, 'bank_transfer');

      const res = await h.http().get('/api/orders/user/history?page=1&pageSize=10').set(h.auth(customer)).expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.map((o: any) => o.id)).toEqual([b.order.id, a.order.id]);
      expect(res.body.data[0].totalPkr).toBe(2000);

      const page2 = await h.http().get('/api/orders/user/history?page=2&pageSize=1').set(h.auth(customer)).expect(200);
      expect(page2.body.data.map((o: any) => o.id)).toEqual([a.order.id]);
    });

    it('IDOR / role checks: other customer 404; customers cannot use admin routes (403); anonymous 401', async () => {
      const a = await h.mkUser('customer');
      const b = await h.mkUser('customer');
      const { order } = await h.checkout(a, 'bank_transfer');
      await h.http().get(`/api/orders/${order.id}`).set(h.auth(b)).expect(404);
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(a)).send({ status: 'cancelled' }).expect(403);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(a)).send({ approve: true }).expect(403);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(a)).send({}).expect(403);
      await h.http().post(`/api/orders/${order.id}/reverify-payment`).set(h.auth(a)).expect(403);
      await h.http().get('/api/orders').set(h.auth(a)).expect(403);
      await h.http().get(`/api/orders/${order.id}`).expect(401);
      await h.http().get(`/api/orders/${order.id}/files`).set(h.auth(b)).expect(404);
    });
  });

  describe('AC-8 currency display / AC-9 settings', () => {
    it('a fresh database gets exchange rates at boot; the order shows PKR plus the converted amount; an unknown currency degrades to PKR only', async () => {
      await h.prisma.exchangeRate.deleteMany();
      await h.services.exchange.onModuleInit();
      expect(await h.prisma.exchangeRate.count()).toBeGreaterThan(0);

      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, 'bank_transfer', { price: 2785 });
      const usd = (await h.http().get(`/api/orders/${order.id}?currencyCode=USD`).set(h.auth(customer)).expect(200)).body.data;
      expect(usd).toMatchObject({ totalPkr: 2785, localCurrencyCode: 'USD', localAmount: 10 });
      const zzz = (await h.http().get(`/api/orders/${order.id}?currencyCode=ZZZ`).set(h.auth(customer)).expect(200)).body.data;
      expect(zzz).toMatchObject({ totalPkr: 2785, localAmount: null });
    });

    it('AC-9: an Admin bank-detail change is what the very next customer sees, with no deploy', async () => {
      const admin = await h.mkUser('admin');
      const put = (acct: string) => h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: true, config: { bankName: 'HBL', accountNumber: acct } }] });
      await put('1111').expect(200);
      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig.accountNumber).toBe('1111');
      await put('2222').expect(200);
      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig.accountNumber).toBe('2222');
    });
  });

  describe('AC-11 refunds (behaviour unchanged by this iteration)', () => {
    it('a full refund sets status + paymentStatus, records the amount, re-locks files, notifies the customer', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ reason: 'test' }).expect(200);

      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(1500);
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Order refunded' } }))?.message).toContain('1500');
    });

    it('a partial refund records the amount and keeps the order status; refunding an unpaid order or more than the total is refused', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const unpaid = await h.checkout(customer, 'bank_transfer');
      await h.http().put(`/api/orders/${unpaid.order.id}/refund`).set(h.auth(admin)).send({}).expect(400);

      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 99999 }).expect(400);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 200 }).expect(200);
      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'partially_refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(200);
    });
  });
});
