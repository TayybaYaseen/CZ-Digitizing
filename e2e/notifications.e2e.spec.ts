import { createOrdersHarness, tinyPng, type OrdersHarness } from '../apps/api/test/integration/helpers/orders-harness';

// docs/specs/2026-08-28-02-notifications-system.md §6's e2e row: "place an order -> see Admin
// dashboard badge increment -> admin marks read -> badge decrements; customer sees
// order-confirmation in-app notification." Like this repo's other e2e/*.e2e.spec.ts, this is an
// API-level walk of that flow against a real Postgres (reusing the same OrdersHarness
// orders-payment.e2e.spec.ts already uses), not a browser-driven one.
//
// On this platform (bank-transfer-only, docs/specs/2026-08-28-08-orders-payment-processing.md) the
// Admin-facing touchpoint in that flow is the receipt upload, not raw order creation — there is no
// separate "new order" Admin notification before a receipt exists for Admin to act on (see
// apps/api/src/orders/orders.service.ts's own notify() call sites) — so this test's Admin-badge
// steps follow the receipt-upload notification (`receipt_uploaded`), the real trigger that puts an
// order in front of Admin at all.
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise). Run from the repo root:
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_notif_e2e_test \
//     node apps/api/node_modules/jest/bin/jest.js --config e2e/jest.config.js notifications
jest.setTimeout(60_000);

describe('Notifications end-to-end flow (docs/specs/2026-08-28-02-notifications-system.md)', () => {
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

  it('order confirmation reaches the customer in-app; the receipt-upload notification reaches Admin, whose badge increments then decrements on mark-read', async () => {
    const customer = await h.mkUser('customer');
    const admin = await h.mkUser('admin');

    await h.http().put('/api/admin/settings/payment-methods').set(h.auth(admin)).send({
      methods: [{ method: 'bank_transfer', isEnabled: true, config: { bankName: 'Habib Bank Limited', accountTitle: 'CZ Digitizing', accountNumber: '0011223344', iban: 'PK36HABB0000001123456702', instructions: 'Use your order reference.' } }],
    }).expect(200);

    // --- place an order -----------------------------------------------------------------------
    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);
    const order = (await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201)).body.data;

    // --- "customer sees order-confirmation in-app notification" -------------------------------
    const customerList = await h.http().get('/api/notifications?page=1&pageSize=20').set(h.auth(customer)).expect(200);
    const confirmation = customerList.body.data.find((n: { notificationType: string }) => n.notificationType === 'order_confirmed');
    expect(confirmation).toMatchObject({ isRead: false, relatedOrderId: order.id });

    // --- Admin dashboard badge starts at whatever it already was; capture the baseline ---------
    const before = (await h.http().get('/api/admin/notifications/unread-count').set(h.auth(admin)).expect(200)).body.data.count;

    // --- "place an order -> see Admin dashboard badge increment" ------------------------------
    // (the receipt upload is the real Admin-facing trigger on this bank-transfer-only platform —
    // see the file-level comment above)
    await h.uploadReceipt(customer, order.id, tinyPng(), 'slip.png').expect(201);

    const afterUpload = (await h.http().get('/api/admin/notifications/unread-count').set(h.auth(admin)).expect(200)).body.data.count;
    expect(afterUpload).toBe(before + 1);

    const adminList = await h.http().get('/api/admin/notifications?page=1&pageSize=20').set(h.auth(admin)).expect(200);
    const receiptNotification = adminList.body.data.find((n: { notificationType: string; relatedOrderId: string }) => n.notificationType === 'receipt_uploaded' && n.relatedOrderId === order.id);
    expect(receiptNotification).toMatchObject({ isRead: false });

    // --- "admin marks read -> badge decrements" ------------------------------------------------
    await h.http().put(`/api/admin/notifications/${receiptNotification.id}/read`).set(h.auth(admin)).expect(200);

    const afterRead = (await h.http().get('/api/admin/notifications/unread-count').set(h.auth(admin)).expect(200)).body.data.count;
    expect(afterRead).toBe(before);

    // AC-8 — marking read must never touch the underlying business record.
    const orderAfter = await h.orderRow(order.id);
    expect(orderAfter.status).toBe('payment_pending');
  });

  // Regression test for the channel-routing fix: before it, every real notify() call site
  // (including checkout's order_confirmed) hardcoded `channels: ['email', 'in_app']`, so WhatsApp
  // and Push were never actually requested in production even though both services were fully
  // built and unit-tested in isolation — a unit test constructing notify() input directly (e.g.
  // notification.service.spec.ts) can't catch that regressing, since it never exercises the real
  // call site. This walks the real checkout endpoint and asserts a NotificationDeliveryLog row
  // exists for whatsapp/push on the resulting order_confirmed notification — proving those channels
  // were actually requested by the real production code path, regardless of whether the delivery
  // itself succeeds (no Twilio credentials in this test environment; the row is written before that
  // provider call is even attempted, so its mere existence is the assertion that matters here).
  //
  // Asserts arrayContaining, not an exact set: this environment's EmailService can attempt a real
  // SMTP connection (whatever SMTP_* is in apps/api/.env, unlike auth.spec.ts's own suite which
  // explicitly mocks EmailService.send) and that connection is not always reliable here (observed
  // ETIMEDOUT against the configured host in other integration runs) — if email genuinely fails,
  // notify()'s own AC-10 fallback correctly adds 'sms' too, which is real, intended behavior, not a
  // regression this test should fail on.

  it('a real checkout requests WhatsApp and Push for order_confirmed, not just email/in_app (channel-routing regression guard)', async () => {
    const customer = await h.mkUser('customer');
    // AC-6 requires a recent inbound WhatsApp message before WhatsApp is even attempted — without
    // this, notify() correctly falls back to email/in_app before dispatch (proven by this test
    // failing with only ['email','in_app','push'] when lastWhatsappInboundAt is left unset).
    await h.prisma.user.update({ where: { id: customer.id }, data: { phone: '+15551234567', lastWhatsappInboundAt: new Date() } });

    const { design, size } = await h.mkDesign(1500);
    await h.addToCart(customer, design, size);
    const order = (await h.http().post('/api/cart/checkout').set(h.auth(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201)).body.data;

    const notification = await h.prisma.notification.findFirstOrThrow({
      where: { recipientUserId: customer.id, notificationType: 'order_confirmed', relatedOrderId: BigInt(order.id) },
    });
    const deliveryLogs = await h.prisma.notificationDeliveryLog.findMany({ where: { notificationId: notification.id } });
    const channelsAttempted = deliveryLogs.map((log: { channel: string }) => log.channel);

    expect(channelsAttempted).toEqual(expect.arrayContaining(['email', 'in_app', 'push', 'whatsapp']));
  });
});
