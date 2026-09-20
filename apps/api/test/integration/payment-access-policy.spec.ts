/* eslint-disable @typescript-eslint/no-explicit-any */
import { createOrdersHarness, type OrdersHarness } from './helpers/orders-harness';

// A-013 FINAL PAYMENT ACCESS POLICY (docs/specs/2026-08-28-08-orders-payment-processing.md §3 AC-6/AC-11):
//
//   Customer files are unlocked only after 100% of the order amount has been paid and the payment has
//   been confirmed by an authorized admin. Partial payment never unlocks files. Any refund, including
//   a partial refund, re-locks file access.
//
// Every assertion below goes through the real HTTP API and a real database: the backend alone decides,
// so none of these depend on any frontend check. Bank transfer is the only payment method.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_pay_test pnpm --filter @czd/api test:integration -- payment-access-policy
jest.setTimeout(60_000);

describe('A-013 final payment access policy — files unlock only at 100% paid and admin-confirmed', () => {
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

  // ---- helpers -------------------------------------------------------------------------------
  const listFiles = (customer: any, orderId: string) => h.http().get(`/api/orders/${orderId}/files`).set(h.auth(customer));
  const download = (customer: any, orderId: string, fileId: string | bigint | number) => h.http().post(`/api/orders/${orderId}/files/${fileId}/download`).set(h.auth(customer));
  const dto = async (who: any, orderId: string) => (await h.http().get(`/api/orders/${orderId}`).set(h.auth(who))).body.data;
  const fileRows = (orderId: string) => h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(orderId) } });
  const receipts = (orderId: string) => h.prisma.paymentReceipt.findMany({ where: { orderId: BigInt(orderId) }, orderBy: { id: 'asc' } });
  const upload = (customer: any, orderId: string) => h.uploadReceipt(customer, orderId).expect(201);
  const firstFileId = async (orderId: string) => (await h.prisma.customerAuthorizedFile.findFirstOrThrow({ where: { orderId: BigInt(orderId) } })).id;

  // The order is locked for every route that hands out files: listing AND a direct download request.
  async function expectLocked(customer: any, orderId: string, fileId: string | bigint | number = 1) {
    const list = await listFiles(customer, orderId);
    expect(list.status).toBe(422);
    expect(h.errCode(list)).toBe('PAYMENT_NOT_CONFIRMED');
    const dl = await download(customer, orderId, fileId);
    expect(dl.status).toBe(422);
    expect(h.errCode(dl)).toBe('PAYMENT_NOT_CONFIRMED');
    expect((await dto(customer, orderId)).filesUnlocked).toBe(false);
  }

  // The order is open: the file list works and a direct download request returns a signed token.
  async function expectUnlocked(customer: any, orderId: string) {
    const list = await listFiles(customer, orderId);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    const dl = await download(customer, orderId, list.body.data[0].id);
    expect(dl.status).toBe(200);
    expect(dl.body.data.downloadUrl).toBeTruthy();
    expect((await dto(customer, orderId)).filesUnlocked).toBe(true);
  }

  // ---- 1. unpaid -----------------------------------------------------------------------------
  it('1. an unpaid order: listing and a direct download are refused, no files are authorized, the DTO says locked', async () => {
    const customer = await h.mkUser('customer');
    const { order } = await h.checkout(customer);

    expect(order).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending', amountDuePkr: 1500, amountPaidPkr: 0, amountOutstandingPkr: 1500, filesUnlocked: false });
    await expectLocked(customer, order.id);
    expect(await fileRows(order.id)).toBe(0);
  });

  // ---- 2. partial payment --------------------------------------------------------------------
  it('2. partial payment (PKR 500 of 1,500) never unlocks; the remaining PKR 1,000 confirmed does', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { order } = await h.checkout(customer);

    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);

    // Payment is incomplete: the order is NOT paid, no files were authorized, everything stays locked.
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await fileRows(order.id)).toBe(0);
    await expectLocked(customer, order.id);
    const partial = await dto(customer, order.id);
    expect(partial).toMatchObject({ amountDuePkr: 1500, amountPaidPkr: 500, amountOutstandingPkr: 1000, paymentStatus: 'pending' });
    expect(partial.receipts[0]).toMatchObject({ reviewStatus: 'confirmed', confirmedAmountPkr: 500 });
    // The customer is told it was partial — and NOT told the payment was confirmed / files are ready.
    expect(await h.notifCount(customer, 'payment_received')).toBe(0);
    expect(await h.notifCount(customer, 'files_ready')).toBe(0);
    const note = await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Partial payment received — order not yet paid' } });
    expect(note?.message).toMatch(/PKR 1,000 is still outstanding.*files stay locked/);
    expect((await h.prisma.auditLog.findFirst({ where: { actionType: 'ORDER_RECEIPT_APPROVED', resourceId: order.id } }))?.changes).toMatchObject({ confirmedAmountPkr: 500, fullyPaid: false });

    // The customer later pays the remaining PKR 1,000 and the complete PKR 1,500 is confirmed.
    await upload(customer, order.id);
    expect((await h.http().get('/api/orders?receiptStatus=pending').set(h.auth(admin))).body.meta.total).toBe(1); // still in the review queue
    await h.approveAmount(admin, order.id, 1000).expect(201);

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 1500, amountOutstandingPkr: 0, filesUnlocked: true });
    await expectUnlocked(customer, order.id);
    expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    expect((await h.prisma.auditLog.findFirst({ where: { actionType: 'ORDER_RECEIPT_APPROVED', resourceId: order.id }, orderBy: { id: 'desc' } }))?.changes).toMatchObject({ confirmedAmountPkr: 1000, fullyPaid: true });
  });

  it('2b. several partial payments still lock until the running total reaches 100% (500 + 500 = 1,000 of 1,500 is not enough)', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { order } = await h.checkout(customer);

    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 1000, amountOutstandingPkr: 500 });
    await expectLocked(customer, order.id);

    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    await expectUnlocked(customer, order.id);
  });

  it('2c. an amount above what is outstanding, zero, negative, non-numeric or over-precise is refused and confirms nothing', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { order } = await h.checkout(customer);
    await upload(customer, order.id);
    const send = (amountPkr: unknown) => h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(admin)).send({ approve: true, amountPkr });

    const tooMuch = await send(1500.01);
    expect(tooMuch.status).toBe(400);
    expect(h.errCode(tooMuch)).toBe('VALIDATION_ERROR');
    for (const bad of [0, -5, 'abc', 500.555, null]) expect((await send(bad)).status).toBe(400);

    // Nothing was confirmed by any of those: the receipt is still awaiting review, the order unpaid and locked.
    expect((await receipts(order.id))[0]).toMatchObject({ reviewStatus: 'pending' });
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    await expectLocked(customer, order.id);
  });

  // ---- 3./4. receipt uploaded / rejected -------------------------------------------------------
  it('3. a receipt that was uploaded but not approved keeps files locked; a customer cannot approve it', async () => {
    const customer = await h.mkUser('customer');
    const order = await h.bankOrderWithReceipt(customer);

    await expectLocked(customer, order.id);
    expect((await receipts(order.id))[0]).toMatchObject({ reviewStatus: 'pending', confirmedAmountPkr: null });
    // The customer cannot approve their own receipt, with or without a claimed amount.
    for (const body of [{ approve: true }, { approve: true, amountPkr: 1500 }]) {
      await h.http().post(`/api/orders/${order.id}/payment-confirmation`).set(h.auth(customer)).send(body).expect(403);
    }
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    await expectLocked(customer, order.id);
  });

  it('4. a rejected receipt keeps files locked (and confirms no money)', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);

    await h.reject(admin, order.id, 'Wrong amount').expect(201);

    expect((await receipts(order.id))[0]).toMatchObject({ reviewStatus: 'rejected', confirmedAmountPkr: null });
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 0, amountOutstandingPkr: 1500 });
    await expectLocked(customer, order.id);
    expect(await fileRows(order.id)).toBe(0);
  });

  // ---- 5. full payment -----------------------------------------------------------------------
  it('5. full payment confirmed by an admin unlocks: listing works and a direct download returns a token', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);
    await expectLocked(customer, order.id);

    await h.approve(admin, order.id).expect(201); // no amount = "the whole outstanding amount"

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    expect((await receipts(order.id))[0]).toMatchObject({ reviewStatus: 'confirmed' });
    expect(Number((await receipts(order.id))[0].confirmedAmountPkr)).toBe(1500);
    await expectUnlocked(customer, order.id);
    // and it stays open as the order moves through fulfilment
    for (const status of ['processing', 'ready', 'completed']) {
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status }).expect(200);
      await expectUnlocked(customer, order.id);
    }
  });

  // ---- 6. credits ----------------------------------------------------------------------------
  it('6. credits (PKR 500) + confirmed bank transfer (PKR 1,000) complete 100% and unlock', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    await h.grantCredits(customer, 500);
    const { order } = await h.checkout(customer, { price: 1500, credits: 500 });
    expect(order).toMatchObject({ totalPkr: 1500, creditsUsed: 500, amountDuePkr: 1000, amountOutstandingPkr: 1000, paymentStatus: 'pending', filesUnlocked: false });

    await upload(customer, order.id);
    // Confirming MORE than the PKR 1,000 still owed is refused: credits are already part of the 1,500.
    await h.approveAmount(admin, order.id, 1500).expect(400);
    await h.approveAmount(admin, order.id, 1000).expect(201);

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    await expectUnlocked(customer, order.id);
  });

  it('7. credits covering only part of the order do not unlock — not at checkout, not after a partial bank payment — until the remainder is paid', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    await h.grantCredits(customer, 500);
    const { order } = await h.checkout(customer, { price: 1500, credits: 500 });

    // Credits applied, bank transfer PKR 0: NOT fully paid.
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await fileRows(order.id)).toBe(0);
    await expectLocked(customer, order.id);

    // Credits + a PARTIAL bank payment (500 of the 1,000 still owed) is still not enough.
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 500, amountOutstandingPkr: 500 });
    await expectLocked(customer, order.id);

    // The remaining 500 completes it.
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    await expectUnlocked(customer, order.id);
  });

  it('7b. credits that cover the ENTIRE order are a full payment: unlocked at once, no bank transfer needed', async () => {
    const customer = await h.mkUser('customer');
    await h.grantCredits(customer, 5000);
    const { order } = await h.checkout(customer, { price: 1500, credits: 5000 });

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    expect(Number((await h.orderRow(order.id)).creditsUsed)).toBe(1500);
    await expectUnlocked(customer, order.id);
  });

  // ---- 8./9. refunds -------------------------------------------------------------------------
  it('8. a PARTIAL refund after full payment re-locks the files (list + direct download), and no status change re-opens them', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, order.id).expect(201);
    await expectUnlocked(customer, order.id);
    const fileId = await firstFileId(order.id);

    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 200, reason: 'goodwill' }).expect(200);

    // Fulfilment status stays "payment_confirmed" but the order is no longer fully paid.
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'partially_refunded' });
    await expectLocked(customer, order.id, fileId);
    expect((await dto(customer, order.id)).amountOutstandingPkr).toBe(0); // nothing is "owed" — it is simply locked
    const refundNote = await h.prisma.notification.findFirst({ where: { recipientUserId: customer.id, title: 'Partial refund issued' } });
    expect(refundNote?.message).toMatch(/files for this order are now locked/); // the customer is told, not surprised

    // Exploiting the refund state: moving the order along cannot re-open it...
    for (const status of ['processing', 'ready', 'completed']) {
      await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status }).expect(200);
      await expectLocked(customer, order.id, fileId);
    }
    // ...neither can a fresh receipt or an approval, and a further partial refund keeps it locked.
    expect((await h.uploadReceipt(customer, order.id)).status).toBe(409);
    expect((await h.approve(admin, order.id)).status).toBeGreaterThanOrEqual(400);
    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 100 }).expect(200);
    await expectLocked(customer, order.id, fileId);
    // The authorized-file rows are not deleted — the gate, not the data, is what locks them.
    expect(await fileRows(order.id)).toBe(1);
  });

  it('8b. a partial refund re-locks an order that was paid with credits + bank transfer, even a 1-rupee refund', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    await h.grantCredits(customer, 500);
    const { order } = await h.checkout(customer, { price: 1500, credits: 500 });
    await upload(customer, order.id);
    await h.approve(admin, order.id).expect(201);
    await expectUnlocked(customer, order.id);

    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 1 }).expect(200);
    await expectLocked(customer, order.id, await firstFileId(order.id));
  });

  it('9. a FULL refund re-locks the files', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, order.id).expect(201);
    const fileId = await firstFileId(order.id);
    await expectUnlocked(customer, order.id);

    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({}).expect(200);

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
    await expectLocked(customer, order.id, fileId);
  });

  it('9b. partial refunds that accumulate to the whole amount end fully refunded — locked at every step', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, order.id).expect(201);
    const fileId = await firstFileId(order.id);

    for (const amountPkr of [500, 500, 500]) {
      await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr }).expect(200);
      await expectLocked(customer, order.id, fileId);
    }
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
  });

  // ---- 10. cancelled --------------------------------------------------------------------------
  it('10. a cancelled order is locked: unpaid, partly paid, and even one that had been fully paid', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');

    const unpaid = (await h.checkout(customer)).order;
    await h.http().put(`/api/orders/${unpaid.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
    await expectLocked(customer, unpaid.id);

    const partial = (await h.checkout(customer)).order;
    await upload(customer, partial.id);
    await h.approveAmount(admin, partial.id, 500).expect(201);
    await h.http().put(`/api/orders/${partial.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
    await expectLocked(customer, partial.id);
    // A cancelled order can never be resurrected by a later receipt.
    expect((await h.uploadReceipt(customer, partial.id)).status).toBe(409);
    expect(await h.orderRow(partial.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });

    const paid = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, paid.id).expect(201);
    const fileId = await firstFileId(paid.id);
    await h.http().put(`/api/orders/${paid.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
    await expectLocked(customer, paid.id, fileId);
  });

  // ---- 11./12. direct download / URL manipulation ----------------------------------------------
  it('11. a direct download request before full payment is rejected — for any file id, including one that belongs to another paid order', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const paid = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, paid.id).expect(201);
    const paidFileId = await firstFileId(paid.id);

    const unpaid = (await h.checkout(customer)).order;
    for (const fileId of [1, paidFileId, 999999]) {
      const res = await download(customer, unpaid.id, fileId);
      expect(res.status).toBe(422);
      expect(h.errCode(res)).toBe('PAYMENT_NOT_CONFIRMED');
    }
    // A partially paid order is refused the same way.
    await upload(customer, unpaid.id);
    await h.approveAmount(admin, unpaid.id, 700).expect(201);
    const res = await download(customer, unpaid.id, paidFileId);
    expect([res.status, h.errCode(res)]).toEqual([422, 'PAYMENT_NOT_CONFIRMED']);
  });

  it('12. a direct download request after full confirmed payment is allowed — and only for that order\'s own files, only to its owner', async () => {
    const customer = await h.mkUser('customer');
    const other = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const paid = await h.bankOrderWithReceipt(customer);
    const otherPaid = await h.bankOrderWithReceipt(other);
    await h.approve(admin, paid.id).expect(201);
    await h.approve(admin, otherPaid.id).expect(201);
    const fileId = await firstFileId(paid.id);
    const otherFileId = await firstFileId(otherPaid.id);

    const ok = await download(customer, paid.id, fileId);
    expect(ok.status).toBe(200);
    expect(ok.body.data.downloadUrl).toBeTruthy();
    // existing download rules still apply: another order's file id, or another customer's order
    expect((await download(customer, paid.id, otherFileId)).status).toBe(404);
    expect((await download(other, paid.id, fileId)).status).toBe(404);
    expect((await listFiles(other, paid.id)).status).toBe(404);
    expect((await h.http().post(`/api/orders/${paid.id}/files/${fileId}/download`)).status).toBe(401);
  });

  // ---- 13. client-side manipulation -----------------------------------------------------------
  it('13. a customer cannot bypass the payment gate by changing client state, order status, amounts, URL parameters or headers', async () => {
    const customer = await h.mkUser('customer');
    const { order } = await h.checkout(customer);
    const id = order.id;

    // order status / payment status / amount — the customer has no route that can write them
    for (const status of ['payment_confirmed', 'processing', 'completed']) {
      await h.http().put(`/api/orders/${id}/status`).set(h.auth(customer)).send({ status }).expect(403);
    }
    await h.http().put(`/api/orders/${id}/refund`).set(h.auth(customer)).send({ amountPkr: 1 }).expect(403);
    await h.http().post(`/api/orders/${id}/payment-confirmation`).set(h.auth(customer)).send({ approve: true, amountPkr: 1500, paymentStatus: 'completed' }).expect(403);
    // a forged body on a route that does exist is rejected or ignored — it never becomes a payment
    const forged = await h.http().post(`/api/cart/checkout`).set(h.auth(customer)).send({ paymentMethod: 'bank_transfer', paymentStatus: 'completed', totalPkr: 1 });
    expect(forged.status).toBeGreaterThanOrEqual(400);

    // uploading a receipt — even one claiming full payment in the multipart form — confirms nothing
    const up = await h.http().post(`/api/orders/${id}/receipt`).set(h.auth(customer)).field('paymentStatus', 'completed').field('amountPkr', '1500').field('approve', 'true').attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), 'r.png');
    expect(up.status).toBe(201);
    expect((await receipts(id))[0]).toMatchObject({ reviewStatus: 'pending', confirmedAmountPkr: null });
    expect(await h.orderRow(id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });

    // URL parameters, headers and bodies that claim "paid" are ignored by the file routes; malformed ids are a plain 404, never a 500
    for (const bad of ['undefined', 'abc', '1e3', '-1', '0x10']) {
      expect((await h.http().get(`/api/orders/${bad}/files`).set(h.auth(customer))).status).toBe(404);
      expect((await h.http().post(`/api/orders/${bad}/files/1/download`).set(h.auth(customer))).status).toBe(404);
      expect((await h.http().post(`/api/orders/${bad}/file-format-request`).set(h.auth(customer)).send({ requestedFormat: 'PES' })).status).toBe(404);
    }
    const spoofed = await h.http().get(`/api/orders/${id}/files?paymentStatus=completed&status=completed&filesUnlocked=true`).set(h.auth(customer)).set('X-Payment-Status', 'completed').set('X-Order-Status', 'payment_confirmed');
    expect(spoofed.status).toBe(422);
    const spoofedDl = await h.http().post(`/api/orders/${id}/files/1/download?paymentStatus=completed`).set(h.auth(customer)).send({ paymentStatus: 'completed', filesUnlocked: true });
    expect(spoofedDl.status).toBe(422);
    // and the DTO's own filesUnlocked is an output the server computes — no input can set it
    await expectLocked(customer, id);
    expect(await fileRows(id)).toBe(0);
  });

  // ---- 14. duplicates / concurrency / replay --------------------------------------------------
  it('14a. duplicate/concurrent approvals of ONE receipt confirm its amount exactly once — a partial can never add up to a full payment', async () => {
    const customer = await h.mkUser('customer');
    const admins = await Promise.all([1, 2, 3, 4, 5, 6].map(() => h.mkUser('admin')));
    const { order } = await h.checkout(customer);
    await upload(customer, order.id);

    const results = await Promise.all(admins.map((admin) => h.approveAmount(admin, order.id, 500)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    // the losers either lost the receipt claim (409) or arrived after it was reviewed (422 RECEIPT_REQUIRED)
    expect(results.filter((r) => r.status !== 201).every((r) => r.status === 409 || r.status === 422)).toBe(true);
    const rows = await receipts(order.id);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].confirmedAmountPkr)).toBe(500); // counted once, not six times
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await fileRows(order.id)).toBe(0);
    await expectLocked(customer, order.id);
  });

  it('14b. replaying an old partial confirmation cannot add its money again or complete the order', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { order } = await h.checkout(customer);
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);

    for (let i = 0; i < 4; i++) {
      const replay = await h.approveAmount(admin, order.id, 500);
      expect(replay.status).toBe(422);
      expect(h.errCode(replay)).toBe('RECEIPT_REQUIRED'); // the latest receipt was already reviewed
    }
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 500, amountOutstandingPkr: 1000 });
    expect(await h.orderRow(order.id)).toMatchObject({ paymentStatus: 'pending' });
    await expectLocked(customer, order.id);
  });

  it('14c. two admins completing the final payment at the same instant confirm it once: one paid order, one set of files, one notification', async () => {
    const customer = await h.mkUser('customer');
    const [admin1, admin2] = await Promise.all([h.mkUser('admin'), h.mkUser('admin')]);
    const { order } = await h.checkout(customer);
    await upload(customer, order.id);
    await h.approveAmount(admin1, order.id, 500).expect(201);
    await upload(customer, order.id);

    const results = await Promise.all([h.approveAmount(admin1, order.id, 1000), h.approveAmount(admin2, order.id, 1000)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
    expect(await fileRows(order.id)).toBe(1);
    expect(await h.notifCount(customer, 'payment_received')).toBe(1);
    expect((await dto(customer, order.id)).amountPaidPkr).toBe(1500);
    await expectUnlocked(customer, order.id);
  });

  it('14d. approving vs cancelling at the same instant: never a paid-and-cancelled order with files', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const order = await h.bankOrderWithReceipt(customer);

    const [approve, cancel] = await Promise.all([h.approve(admin, order.id), h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' })]);

    const row = await h.orderRow(order.id);
    if (row.status === 'cancelled') {
      expect(await fileRows(order.id)).toBe(0);
      expect(row.paymentStatus).toBe('pending');
      await expectLocked(customer, order.id);
    } else {
      expect(approve.status).toBe(201);
      expect(cancel.status).toBe(409);
      expect(row).toMatchObject({ status: 'payment_confirmed', paymentStatus: 'completed' });
      await expectUnlocked(customer, order.id);
    }
  });

  // ---- other file-access paths ----------------------------------------------------------------
  it('the extra-file-format request path follows the same rule: refused unpaid, partly paid and after a partial refund; allowed only when fully paid', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const ask = (orderId: string) => h.http().post(`/api/orders/${orderId}/file-format-request`).set(h.auth(customer)).send({ requestedFormat: 'PES' });

    const { order } = await h.checkout(customer);
    expect((await ask(order.id)).status).toBe(422);
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 500).expect(201);
    expect((await ask(order.id)).status).toBe(422);
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 1000).expect(201);
    expect((await ask(order.id)).status).toBe(201);

    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 100 }).expect(200);
    const after = await ask(order.id);
    expect(after.status).toBe(422);
    expect(h.errCode(after)).toBe('PAYMENT_NOT_CONFIRMED');
  });

  it('a stored partial-payment record can never make an order look paid: paymentStatus stays pending and amounts are exposed only as outputs', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');
    const { order } = await h.checkout(customer);
    await upload(customer, order.id);
    await h.approveAmount(admin, order.id, 1499.99).expect(201); // one paisa-level short is still short

    expect(await h.orderRow(order.id)).toMatchObject({ status: 'payment_pending', paymentStatus: 'pending' });
    expect(await dto(customer, order.id)).toMatchObject({ amountPaidPkr: 1499.99, amountOutstandingPkr: 0.01, filesUnlocked: false });
    await expectLocked(customer, order.id);
  });
});
