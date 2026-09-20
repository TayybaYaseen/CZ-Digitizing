/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, tinyPdf, tinyPng, type OrdersHarness } from './helpers/orders-harness';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — BANK TRANSFER ONLY:
// checkout with the exact PKR amount (AC-3), receipt upload + Admin review (AC-4/AC-5), files blocked
// until paid (AC-6), order history (AC-7), display-only currency (AC-8), Admin-configured bank details
// (AC-9), credits interacting with the amount due, the payment-bypass / cancelled-order state guards,
// duplicate checkout, manual refunds (AC-11), and proof that no PayPal/Stripe flow exists.
// Credit-package / subscription purchases: purchases-bank-transfer.spec.ts.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_test pnpm --filter @czd/api test:integration -- orders
// App boot (Nest compile + Prisma) can exceed the 15s default when the machine is busy.
jest.setTimeout(60_000);

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
      const a = await h.checkout(customer);
      const b = await h.checkout(customer);

      expect(a.res.status).toBe(201);
      expect(a.order).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', paymentMethod: 'bank_transfer', totalPkr: 1500, amountDuePkr: 1500, creditsUsed: 0 });
      // Bank transfer only: no provider session / provider charge / provider amount in the response.
      expect(a.order).not.toHaveProperty('payment');
      expect(a.order).not.toHaveProperty('providerCharge');
      expect(a.order.bankTransferReference).toMatch(/^CZD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(a.order.bankTransferReference).not.toBe(b.order.bankTransferReference);
      expect((await h.http().get('/api/cart').set(h.auth(customer))).body.data.items).toHaveLength(0);
    });

    it('order price is a snapshot: a later catalog price change does not alter the order', async () => {
      const customer = await h.mkUser('customer');
      const { order, design } = await h.checkout(customer, { price: 1500 });
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
      const png = await h.checkout(customer);
      const pdf = await h.checkout(customer);
      const jpg = await h.checkout(customer);

      const up1 = await h.uploadReceipt(customer, png.order.id).expect(201);
      expect(up1.body.data.receipts[0]).toMatchObject({ reviewStatus: 'pending', contentType: 'image/png', originalFilename: 'receipt.png' });
      await h.uploadReceipt(customer, pdf.order.id, tinyPdf(), 'slip.pdf').expect(201);
      await h.uploadReceipt(customer, jpg.order.id, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]), 'slip.jpeg').expect(201);

      expect(await h.notifCount(admin1, 'receipt_uploaded')).toBe(3);
      expect(await h.notifCount(admin2, 'receipt_uploaded')).toBe(3);
    });

    it('rejects executables, HTML, SVG, text and archives (415), whatever their name or declared type', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer);
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
      const { order } = await h.checkout(customer);
      const res = await h.uploadReceipt(customer, order.id, Buffer.concat([tinyPng(), Buffer.alloc(11 * 1024 * 1024)]), 'big.png');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await h.prisma.paymentReceipt.count()).toBe(0);
    });

    it('only the owner of an order can upload (other customer 404, no file 422)', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const bank = await h.checkout(customer);
      await h.uploadReceipt(other, bank.order.id).expect(404);
      const noFile = await h.http().post(`/api/orders/${bank.order.id}/receipt`).set(h.auth(customer));
      expect(noFile.status).toBe(422);
      expect(h.errCode(noFile)).toBe('RECEIPT_REQUIRED');
    });

    it('only one receipt can await review at a time (409 RECEIPT_ALREADY_PENDING), incl. simultaneous uploads', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer);
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
      await h.checkout(customer); // no receipt -> not in the queue

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
      const { order } = await h.checkout(customer);
      const up = await h.uploadReceipt(customer, order.id, tinyPng(), 'my slip.png').expect(201);
      const receiptId = up.body.data.receipts[0].id;

      const res = await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(admin)).buffer(true).parse(binary);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['content-disposition']).toContain(`receipt-${receiptId}.png`);
      expect(Buffer.compare(res.body as Buffer, tinyPng())).toBe(0);

      const pdfOrder = await h.checkout(customer);
      const pdfUp = await h.uploadReceipt(customer, pdfOrder.order.id, tinyPdf(), 'slip.pdf').expect(201);
      const pdfRes = await h.http().get(`/api/orders/${pdfOrder.order.id}/receipts/${pdfUp.body.data.receipts[0].id}/file`).set(h.auth(admin)).buffer(true).parse(binary);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
    });

    it('the receipt file is never public: anonymous 401, customers (even the owner) 403, wrong order/receipt id 404', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer);
      const other = await h.checkout(customer);
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
      const { order } = await h.checkout(customer);
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
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Payment receipt rejected — please upload a new one' } }))?.message).toMatch(/Amount does not match.*upload a new receipt/);
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
      const { order } = await h.checkout(customer);
      const res = await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true });
      expect(res.status).toBe(422);
      expect(h.errCode(res)).toBe('RECEIPT_REQUIRED');
    });

    it('rejecting without a written reason still tells the customer to upload a new receipt', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.reject(admin, order.id).expect(201);
      const note = await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Payment receipt rejected — please upload a new one' } });
      expect(note?.message).toContain('upload a new receipt');
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
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
    it('payment_confirmed via PUT /status is refused (with or without a receipt) and leaves the order unpaid', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const bankNoReceipt = await h.checkout(customer);
      const bankWithReceipt = await h.bankOrderWithReceipt(customer);

      const noReceipt = await h.http().put(`/api/orders/${bankNoReceipt.order.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect([noReceipt.status, h.errCode(noReceipt)]).toEqual([422, 'RECEIPT_REQUIRED']);

      const withReceipt = await h.http().put(`/api/orders/${bankWithReceipt.id}/status`).set(h.auth(admin)).send({ status: 'payment_confirmed' });
      expect([withReceipt.status, h.errCode(withReceipt)]).toEqual([409, 'PAYMENT_CONFIRMATION_REQUIRED']);

      for (const id of [bankNoReceipt.order.id, bankWithReceipt.id]) {
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

      const other = await h.checkout(customer);
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
      const { res, order } = await h.checkout(customer, { price: 1500, credits: 5000 });

      expect(res.status).toBe(201);
      expect(order).toMatchObject({ totalPkr: 1500, creditsUsed: 1500, amountDuePkr: 0 });
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(3500);
      expect((await h.services.credits.getBalance(customer.id)).used).toBe(1500);
    });

    it('a fully credit-covered order is paid at once: files released, no bank transfer and no receipt requested', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, { credits: 5000 });

      expect(order).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed', amountDuePkr: 0, bankTransferReference: null });
      expect(await h.filesStatus(customer, order.id)).toBe(200);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    });

    it('a fully credit-covered BANK-TRANSFER order gets no reference, nothing to transfer, and no receipt is accepted', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, { credits: 5000 });

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
      const { order } = await h.checkout(customer, { credits: 500 });
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
      const { order } = await h.checkout(customer, { credits: 5000 });
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

    // The HTTP-level test above can be won by a request that simply reads the cart after the first
    // checkout committed. This one FORCES the race: two checkouts holding the same stale cart
    // snapshot (as two requests that both read the cart before either committed would) — only the
    // row lock + "cart still holds these exact lines" check in createFromCart can stop the second.
    it('two checkouts holding the same stale cart snapshot: exactly one order, the other is refused with CART_CHANGED', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const cart = await h.prisma.cart.findFirstOrThrow({ where: { customerId: customer.id } });
      const snapshot = await h.services.cart.loadCartWithItems(cart.id);
      const actor = { sub: customer.id.toString(), role: 'customer' };

      const results = await Promise.allSettled([1, 2, 3].map(() => h.services.orders.createFromCart(actor, snapshot, 'bank_transfer', 0)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(2);
      rejected.forEach((r) => expect(r.reason).toMatchObject({ code: 'CART_CHANGED' }));
      expect(await h.prisma.order.count()).toBe(1);
      expect(await h.prisma.orderItem.count()).toBe(1);
    });

    it('a stale snapshot whose lines changed underneath it is refused (never orders lines that are no longer in the cart)', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const cart = await h.prisma.cart.findFirstOrThrow({ where: { customerId: customer.id } });
      const snapshot = await h.services.cart.loadCartWithItems(cart.id);
      await h.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }); // customer removed the line meanwhile

      await expect(h.services.orders.createFromCart({ sub: customer.id.toString(), role: 'customer' }, snapshot, 'bank_transfer', 0)).rejects.toMatchObject({ code: 'CART_CHANGED' });
      expect(await h.prisma.order.count()).toBe(0);
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
    it('an unpaid order has files blocked (422); a paid order allows a download token; a full refund blocks it again', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const unpaid = await h.checkout(customer);
      expect(await h.filesStatus(customer, unpaid.order.id)).toBe(422);

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
    it('history accumulates every purchase, newest first, scoped to the customer, paginated', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const a = await h.checkout(customer, { price: 1000 });
      const b = await h.checkout(customer, { price: 2000 });
      await h.checkout(other);

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
      const { order } = await h.checkout(a);
      await h.http().get(`/api/orders/${order.id}`).set(h.auth(b)).expect(404);
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(a)).send({ status: 'cancelled' }).expect(403);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(a)).send({ approve: true }).expect(403);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(a)).send({}).expect(403);
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
      const { order } = await h.checkout(customer, { price: 2785 });
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

  describe('bank details come from Admin Settings (never hardcoded)', () => {
    it('Admin saves bank name, account title, account number, IBAN and instructions; the public payment page data returns exactly those', async () => {
      const admin = await h.mkUser('admin');
      const details = { bankName: 'Habib Bank Limited', accountTitle: 'CZ Digitizing', accountNumber: '0011223344', iban: 'PK36HABB0000001123456702', instructions: 'Put your order reference in the payment note.' };
      await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: true, config: details }] }).expect(200);

      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig).toEqual(details);
      // Admin's own view returns the same fields.
      const adminView = (await h.http().get('/api/admin/settings').set(h.auth(admin)).expect(200)).body.data;
      expect(adminView.paymentMethods.find((m: any) => m.method === 'bank_transfer').config).toEqual(details);
    });

    it('only the known bank fields are stored or returned — anything else in the submitted config is dropped', async () => {
      const admin = await h.mkUser('admin');
      await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: true, config: { bankName: 'HBL', accountNumber: '1', apiSecret: 'shh', accountEmail: 'pay@paypal.example' } }] }).expect(200);
      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig).toEqual({ bankName: 'HBL', accountNumber: '1' });
    });

    it('PayPal / credit-card settings entries no longer exist: the method enum is bank_transfer only (400)', async () => {
      const admin = await h.mkUser('admin');
      for (const method of ['paypal', 'credit_card', 'stripe']) {
        const res = await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method, isEnabled: true }] });
        expect([method, res.status]).toEqual([method, 400]);
      }
      expect(await h.prisma.paymentMethodSetting.count({ where: { method: { not: 'bank_transfer' } } })).toBe(0);
    });

    it('omitting config while toggling keeps the saved details; disabling bank transfer hides them from customers', async () => {
      const admin = await h.mkUser('admin');
      await h.setBankDetails({ bankName: 'HBL', accountNumber: '9' });
      await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: false }] }).expect(200);
      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig).toBeNull();
      await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({ methods: [{ method: 'bank_transfer', isEnabled: true }] }).expect(200);
      expect((await h.http().get('/api/settings/public')).body.data.bankTransferConfig).toEqual({ bankName: 'HBL', accountNumber: '9' });
    });

    it('customers cannot change the bank details (403) and anonymous callers cannot (401)', async () => {
      const customer = await h.mkUser('customer');
      const body = { methods: [{ method: 'bank_transfer', isEnabled: true, config: { accountNumber: 'evil' } }] };
      await h.http().put('/api/admin/settings/payment-methods').set(h.auth(customer)).send(body).expect(403);
      await h.http().put('/api/admin/settings/payment-methods').send(body).expect(401);
    });
  });

  describe('exact PKR amounts — no currency conversion anywhere in the payment flow', () => {
    it('an order of PKR 1,500 asks for exactly 1500 PKR: totalPkr = amountDuePkr = 1500, and the customer message says PKR 1,500', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, { price: 1500 });
      expect(order).toMatchObject({ totalPkr: 1500, amountDuePkr: 1500, creditsUsed: 0 });
      const row = await h.orderRow(order.id);
      expect(Number(row.totalPkr)).toBe(1500);
      expect(row.currencyCode).toBe('PKR');
      const note = await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'order_confirmed' } });
      expect(note?.message).toContain('PKR 1,500');
      expect(note?.message).not.toMatch(/USD|\$|cents/i);
    });

    it('fractional PKR totals are kept exact (no float noise, no rounding to whole rupees)', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer, { price: 1234.5 });
      expect(order).toMatchObject({ totalPkr: 1234.5, amountDuePkr: 1234.5 });
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'order_confirmed' } }))?.message).toContain('PKR 1,234.50');
    });

    it('with partial credits the amount to transfer is exactly total minus credits, in PKR', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 400);
      const { order } = await h.checkout(customer, { price: 1500, credits: 400 });
      expect(order).toMatchObject({ totalPkr: 1500, creditsUsed: 400, amountDuePkr: 1100 });
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'order_confirmed' } }))?.message).toContain('PKR 1,100');
    });

    it('exchange rates are display-only: changing or deleting them never changes what is due', async () => {
      const customer = await h.mkUser('customer');
      await h.prisma.exchangeRate.deleteMany();
      const { order } = await h.checkout(customer, { price: 1500 });
      expect(order).toMatchObject({ totalPkr: 1500, amountDuePkr: 1500 });
      await h.prisma.exchangeRate.create({ data: { currencyCode: 'USD', rateToPkr: 1 } });
      expect((await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data).toMatchObject({ totalPkr: 1500, amountDuePkr: 1500 });
    });

    it('the orders table has no PayPal/Stripe/provider-amount columns at all', async () => {
      const cols: { column_name: string }[] = await h.prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`);
      const bad = cols.map((c) => c.column_name).filter((c) => /paypal|stripe|provider/i.test(c));
      expect(bad).toEqual([]);
      const tables: { table_name: string }[] = await h.prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
      expect(tables.map((t) => t.table_name).filter((t) => /pending_(credit|subscription)|paypal|stripe/i.test(t))).toEqual([]);
    });
  });

  describe('no PayPal / Stripe payment flow exists', () => {
    it('checkout rejects paypal and stripe as a payment method (400) and creates nothing', async () => {
      const customer = await h.mkUser('customer');
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      for (const paymentMethod of ['paypal', 'stripe', 'credit_card']) {
        const res = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod });
        expect([paymentMethod, res.status]).toEqual([paymentMethod, 400]);
      }
      expect(await h.prisma.order.count()).toBe(0);
      // and a plain checkout with no method at all is a bank-transfer order
      const ok = await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({}).expect(201);
      expect(ok.body.data.paymentMethod).toBe('bank_transfer');
    });

    it('there are no provider endpoints: webhooks, payment-session, verify/reverify-payment all 404', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const { order } = await h.checkout(customer);
      const gone: [string, string, any][] = [
        ['post', '/api/webhooks/paypal', undefined],
        ['post', '/api/webhooks/stripe', undefined],
        ['post', '/api/webhooks/credits/paypal', undefined],
        ['post', '/api/webhooks/credits/stripe', undefined],
        ['post', '/api/webhooks/subscriptions/paypal', undefined],
        ['post', '/api/webhooks/subscriptions/stripe', undefined],
        ['post', `/api/orders/${order.id}/payment-session`, customer],
        ['post', `/api/orders/${order.id}/verify-payment`, customer],
        ['post', `/api/orders/${order.id}/reverify-payment`, admin],
      ];
      for (const [method, url, who] of gone) {
        const req = (h.http() as any)[method](url);
        const res = await (who ? req.set(h.auth(who)) : req).send({});
        expect([method, url, res.status]).toEqual([method, url, 404]);
      }
    });

    it('a webhook-shaped POST cannot confirm a payment: the order stays unpaid and files stay blocked', async () => {
      const customer = await h.mkUser('customer');
      const { order } = await h.checkout(customer);
      await h.http().post('/api/webhooks/paypal').send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'x' } } } });
      await h.http().post('/api/webhooks/stripe').set('stripe-signature', 't=1,v1=abc').send({ type: 'payment_intent.succeeded', data: { object: { metadata: { orderId: order.id } } } });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
      expect(await h.filesStatus(customer, order.id)).toBe(422);
    });

    it('quote conversion and custom-request approval reject paypal/stripe too (400)', async () => {
      const admin = await h.mkUser('admin');
      const customer = await h.mkUser('customer');
      for (const paymentMethod of ['paypal', 'stripe']) {
        await h.http().post('/api/quotes/1/convert').set(h.auth(admin)).send({ paymentMethod }).expect(400);
        await h.http().post('/api/custom-requests/1/approve').set(h.auth(customer)).send({ paymentMethod }).expect(400);
      }
    });

    it('the only payment_method value the database accepts is bank_transfer', async () => {
      const customer = await h.mkUser('customer');
      for (const method of ['paypal', 'stripe']) {
        await expect(h.prisma.$executeRawUnsafe(`INSERT INTO orders (customer_id, payment_method, total_pkr, updated_at) VALUES (${customer.id}, '${method}', 100, now())`)).rejects.toBeTruthy();
      }
    });
  });

  describe('already-paid orders never ask for another payment', () => {
    it('an approved order refuses another receipt and a second approval, and creates no second payment request', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.approve(admin, order.id).expect(201);
      const before = await h.prisma.paymentReceipt.count({ where: { orderId: BigInt(order.id) } });

      const up = await h.uploadReceipt(customer, order.id);
      expect([up.status, h.errCode(up)]).toEqual([409, 'ORDER_ALREADY_CONFIRMED']);
      const again = await h.approve(admin, order.id);
      expect([again.status, h.errCode(again)]).toEqual([409, 'ORDER_ALREADY_CONFIRMED']);
      expect(await h.prisma.paymentReceipt.count({ where: { orderId: BigInt(order.id) } })).toBe(before);
      expect(await h.notifCount(customer, 'payment_received')).toBe(1);
      expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(1);
    });
  });

  describe('AC-11 refunds — MANUAL, admin-managed (no provider refund exists)', () => {
    it('a full refund sets status + paymentStatus, records the amount, re-locks files, and tells the customer it is returned manually', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ reason: 'test' }).expect(200);

      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(1500);
      expect(await h.filesStatus(customer, order.id)).toBe(422);
      const message = (await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Order refunded' } }))?.message;
      expect(message).toContain('PKR 1,500');
      expect(message).toMatch(/returned manually to your bank account/);
      expect(message).not.toMatch(/PayPal|Stripe|card/i);
      const audit = await h.prisma.auditLog.findFirst({ where: { actionType: 'ORDER_REFUNDED', resourceId: order.id } });
      expect(audit?.changes).toMatchObject({ manual: true, isFullRefund: true });
    });

    it('partial refunds accumulate and can never exceed the order total; the last one completes the refund', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.approve(admin, order.id).expect(201);
      const refund = (amountPkr?: number) => h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send(amountPkr === undefined ? {} : { amountPkr });

      await refund(500).expect(200);
      await refund(600).expect(200);
      expect(Number((await h.orderRow(order.id)).refundedAmountPkr)).toBe(1100);
      // 400 is all that is left — 401 would over-refund
      await refund(401).expect(400);
      expect(Number((await h.orderRow(order.id)).refundedAmountPkr)).toBe(1100);
      await refund().expect(200); // omitted amount = whatever is left
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
      expect(Number((await h.orderRow(order.id)).refundedAmountPkr)).toBe(1500);
      await refund(1).expect(400); // fully refunded: nothing left
    });

    it('two simultaneous full refunds apply once and restore credits once', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 500);
      const { order } = await h.checkout(customer, { price: 1500, credits: 500 });
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(0);

      const results = await Promise.all([1, 2].map(() => h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({})));
      // One wins; the other either lost the claim (409) or arrived after it committed (400: nothing left to refund).
      const statuses = results.map((r) => r.status).sort();
      expect(statuses[0]).toBe(200);
      expect([400, 409]).toContain(statuses[1]);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(500);
      expect(await h.prisma.creditTransaction.count({ where: { relatedOrderId: BigInt(order.id), type: 'refund' } })).toBe(1);
    });

    it('customers cannot refund (403)', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const order = await h.bankOrderWithReceipt(customer);
      await h.approve(admin, order.id).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(customer)).send({}).expect(403);
      expect((await h.orderRow(order.id)).paymentStatus).toBe('completed');
    });

    it('a partial refund records the amount and keeps the order status; refunding an unpaid order or more than the total is refused', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      const unpaid = await h.checkout(customer);
      await h.http().put(`/api/orders/${unpaid.order.id}/refund`).set(h.auth(admin)).send({}).expect(400);

      const order = await h.bankOrderWithReceipt(customer);
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true }).expect(201);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 99999 }).expect(400);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 200 }).expect(200);
      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'partially_refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(200);
      // FINAL PAYMENT ACCESS POLICY: any refund, a partial one included, re-locks the files.
      expect(await h.filesStatus(customer, order.id)).toBe(422);
    });
  });
  describe('refund ceiling = what the customer actually transferred (total − credits)', () => {
    it('a partly credit-paid order can be refunded at most the transferred part; completing it restores the credits once', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 500);
      const { order } = await h.checkout(customer, { price: 1500, credits: 500 }); // PKR 1,000 to transfer
      await h.uploadReceipt(customer, order.id).expect(201);
      await h.approve(admin, order.id).expect(201);
      const refund = (amountPkr?: number) => h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send(amountPkr === undefined ? {} : { amountPkr });

      // 1,500 is the order total but only 1,000 was transferred: over-refunding is refused.
      expect((await refund(1500)).status).toBe(400);
      expect((await refund(1001)).status).toBe(400);
      await refund(400).expect(200);
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'partially_refunded' });
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(0); // not restored by a partial refund
      expect((await refund(601)).status).toBe(400);
      await refund().expect(200); // the remaining 600

      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(1000);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(500);
      expect(await h.prisma.creditTransaction.count({ where: { relatedOrderId: BigInt(order.id), type: 'refund' } })).toBe(1);
      expect((await refund(1)).status).toBe(400);
      expect((await refund()).status).toBe(400);
      const msg = (await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Order refunded' } }))?.message;
      expect(msg).toContain('PKR 600');
      expect(msg).toContain('PKR 500 of credits');
      expect(msg).not.toContain('PKR 1,500');
    });

    it('an order paid entirely with credits has no bank money to refund: only a zero-amount full refund restoring the credits is possible', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, { price: 1500, credits: 5000 });
      expect((await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 100 })).status).toBe(400);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);
      const row = await h.orderRow(order.id);
      expect(row).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
      expect(Number(row.refundedAmountPkr)).toBe(0);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(5000);
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Order refunded' } }))?.message).toContain('no bank refund is due');
      // a second attempt cannot restore the credits again
      expect((await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({})).status).toBe(400);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(5000);
    });
  });

  describe('credits on cancelled orders', () => {
    it('cancelling an UNPAID order that used credits returns them, exactly once', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 1000);
      const { order } = await h.checkout(customer, { price: 1500, credits: 600 });
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(400);
      const cancel = () => h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' });

      await cancel().expect(200);
      expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 1000, used: 0, total: 1000 });
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
      expect((await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Order status updated' } }))?.message).toContain('PKR 600 of credits');
      expect((await cancel()).status).toBe(409); // cancelled -> cancelled is not a transition
      expect(await h.prisma.creditTransaction.count({ where: { relatedOrderId: BigInt(order.id), type: 'refund' } })).toBe(1);
      // and a late receipt cannot revive it, so the credits cannot be spent twice on it
      expect(h.errCode(await h.uploadReceipt(customer, order.id))).toBe('ORDER_NOT_PAYABLE');
    });

    it('two admins cancelling at once return the credits once', async () => {
      const customer = await h.mkUser('customer');
      const admin1 = await h.mkUser('admin');
      const admin2 = await h.mkUser('admin');
      await h.grantCredits(customer, 1000);
      const { order } = await h.checkout(customer, { price: 1500, credits: 1000 });
      const results = await Promise.all([admin1, admin2].map((a) => h.http().put(`/api/orders/${order.id}/status`).set(h.auth(a)).send({ status: 'cancelled' })));
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(1000);
      expect(await h.prisma.creditTransaction.count({ where: { relatedOrderId: BigInt(order.id), type: 'refund' } })).toBe(1);
    });

    it('cancelling vs. approving the receipt at the same instant: exactly one wins and credits are never both kept and returned', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 500);
      const { order } = await h.checkout(customer, { price: 1500, credits: 500 });
      await h.uploadReceipt(customer, order.id).expect(201);
      const [cancelled, approved] = await Promise.all([
        h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }),
        h.approve(admin, order.id),
      ]);
      const row = await h.orderRow(order.id);
      if (row.status === 'cancelled') {
        expect(cancelled.status).toBe(200);
        expect(approved.status).toBe(409);
        expect((await h.services.credits.getBalance(customer.id)).available).toBe(500); // returned
      } else {
        expect(approved.status).toBe(201);
        expect(cancelled.status).toBe(409);
        expect(row.paymentStatus).toBe('completed');
        expect((await h.services.credits.getBalance(customer.id)).available).toBe(0); // kept: the order was paid
      }
    });

    it('a failed checkout consumes no credits (insufficient balance / stale cart)', async () => {
      const customer = await h.mkUser('customer');
      await h.grantCredits(customer, 300);
      const { design, size } = await h.mkDesign(1500);
      await h.addToCart(customer, design, size);
      const cart = await h.prisma.cart.findFirstOrThrow({ where: { customerId: customer.id } });
      const snapshot = await h.services.cart.loadCartWithItems(cart.id);
      await h.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await expect(h.services.orders.createFromCart({ sub: customer.id.toString(), role: 'customer' }, snapshot, 'bank_transfer', 300)).rejects.toMatchObject({ code: 'CART_CHANGED' });
      expect(await h.services.credits.getBalance(customer.id)).toEqual({ available: 300, used: 0, total: 300 });
      expect(await h.prisma.creditTransaction.count({ where: { customerId: customer.id, type: 'usage' } })).toBe(0);
    });

    it('cancelling a PAID order does not silently keep the customer whole: credits/money come back only through the refund action, which then works once', async () => {
      const customer = await h.mkUser('customer');
      const admin = await h.mkUser('admin');
      await h.grantCredits(customer, 5000);
      const { order } = await h.checkout(customer, { price: 1500, credits: 5000 }); // paid by credits at once
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(3500); // not auto-returned: the order was paid
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);
      expect((await h.services.credits.getBalance(customer.id)).available).toBe(5000);
    });
  });

  describe('receipt review and refunds are staff-authorized (role + explicit orders permission)', () => {
    it('customers and anonymous callers can never approve, reject, refund, change status or open a receipt file', async () => {
      const customer = await h.mkUser('customer');
      const other = await h.mkUser('customer');
      const order = await h.bankOrderWithReceipt(customer);
      const receiptId = (await h.orderRow(order.id)) && (await h.prisma.paymentReceipt.findFirstOrThrow({ where: { orderId: BigInt(order.id) } })).id.toString();
      for (const who of [customer, other]) {
        await h.approve(who, order.id).expect(403);
        await h.reject(who, order.id, 'x').expect(403);
        await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(who)).send({}).expect(403);
        await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(who)).send({ status: 'payment_confirmed' }).expect(403);
        await h.http().get(`/api/orders/${order.id}/receipts/${receiptId}/file`).set(h.auth(who)).expect(403);
      }
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).send({ approve: true }).expect(401);
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    });

    it('a freelancer/moderator has NO access to orders until an admin grants the orders permission; read_only cannot approve; revoking removes it', async () => {
      const customer = await h.mkUser('customer');
      const staff = await h.mkUser('freelancer');
      const order = await h.bankOrderWithReceipt(customer);

      // no permission at all
      await h.approve(staff, order.id).expect(403);
      await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(staff)).expect(403);
      expect(await h.prisma.auditLog.count({ where: { adminUserId: staff.id, actionType: 'ACCESS_DENIED' } })).toBeGreaterThanOrEqual(2);

      // read_only: can see the queue, cannot approve/reject/refund/change status
      const grant = await h.prisma.adminPermission.create({ data: { userId: staff.id, module: 'orders', accessLevel: 'read_only' } });
      await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(staff)).expect(200);
      await h.approve(staff, order.id).expect(403);
      await h.reject(staff, order.id, 'x').expect(403);
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(staff)).send({}).expect(403);
      expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });

      // crud: allowed (an admin explicitly delegated it)
      await h.prisma.adminPermission.update({ where: { id: grant.id }, data: { accessLevel: 'crud' } });
      await h.approve(staff, order.id).expect(201);
      expect((await h.prisma.auditLog.findFirst({ where: { actionType: 'ORDER_RECEIPT_APPROVED', resourceId: order.id } }))?.adminUserId).toBe(staff.id);

      // revoked: no longer allowed
      const order2 = await h.bankOrderWithReceipt(customer);
      await h.prisma.adminPermission.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
      await h.approve(staff, order2.id).expect(403);
      expect(await h.orderRow(order2.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    });

    it('the permission for a different module does not grant order access', async () => {
      const customer = await h.mkUser('customer');
      const staff = await h.mkUser('freelancer');
      await h.prisma.adminPermission.create({ data: { userId: staff.id, module: 'designs', accessLevel: 'crud' } });
      const order = await h.bankOrderWithReceipt(customer);
      await h.approve(staff, order.id).expect(403);
    });
  });

});
