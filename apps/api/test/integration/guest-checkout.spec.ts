/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'crypto';
import request from 'supertest';
import { createOrdersHarness, tinyPng, type OrdersHarness } from './helpers/orders-harness';

// Guest checkout — buy and pay (bank transfer) without registering or signing in, then see the order
// on the home page from the same browser. Every assertion goes through the real HTTP API and a real
// database; a supertest agent stands in for one browser (it keeps that browser's cookies).
//
// Requires a THROWAWAY Postgres (the harness refuses otherwise): see helpers/orders-harness.ts.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_guest_checkout_test pnpm --filter @czd/api test:integration -- guest-checkout
jest.setTimeout(60_000);

const COOKIE = 'czd_guest_orders';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('Guest checkout — orders without an account', () => {
  let h: OrdersHarness;

  beforeAll(async () => {
    h = await createOrdersHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
    // Rate-limit counters live in (mocked) Redis keyed per IP+route, and every test here shares one
    // IP — same reset as auth.spec.ts, so one test's checkouts don't 429 the next test's.
    const { RedisService } = await import('../../src/redis/redis.service');
    await (h.app.get(RedisService) as any).client.flushdb();
  });

  // ---- helpers -------------------------------------------------------------------------------
  const browser = () => request.agent(h.app.getHttpServer());
  const guestKeyOf = (res: request.Response): string | undefined => {
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${COOKIE}=`));
    return raw ? decodeURIComponent(raw.split(';')[0].slice(COOKIE.length + 1)) : undefined;
  };
  const setCookieOf = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${COOKIE}=`)) ?? '';

  async function addDesign(agent: ReturnType<typeof browser>, price = 1500) {
    const { design, size } = await h.mkDesign(price);
    await agent.post('/api/cart/items').send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    return { design, size };
  }

  async function guestBuy(agent: ReturnType<typeof browser>, over: Record<string, unknown> = {}, price = 1500) {
    const { design } = await addDesign(agent, price);
    const res = await agent.post('/api/cart/guest-checkout').send({ name: 'Ayesha Khan', email: 'ayesha@guest-test.example.com', whatsapp: '+92 300 1234567', ...over });
    return { res, order: res.body.data, design };
  }

  const guestReceipt = (agent: ReturnType<typeof browser>, orderId: string) => agent.post(`/api/guest-orders/${orderId}/receipt`).attach('file', tinyPng(), 'slip.png');

  async function paidGuestOrder(agent: ReturnType<typeof browser>, admin: any, over: Record<string, unknown> = {}) {
    const { order } = await guestBuy(agent, over);
    await guestReceipt(agent, order.id).expect(201);
    await h.approve(admin, order.id).expect(201);
    return order;
  }

  // ---- 1-2: Guest A creates an order and sees it ------------------------------------------------
  it('places an order with no account and no sign-in, and binds it to this browser with an httpOnly key cookie', async () => {
    const a = browser();
    const { res, order, design } = await guestBuy(a);

    expect(res.status).toBe(201);
    expect(order.status).toBe('payment_pending');
    expect(order.paymentStatus).toBe('pending');
    expect(order.filesUnlocked).toBe(false);
    expect(order.bankTransferReference).toBeTruthy();
    expect(order.customerId).toBeUndefined(); // no internal account ids in a guest response

    const key = guestKeyOf(res)!;
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setCookieOf(res)).toMatch(/HttpOnly/i);
    expect(setCookieOf(res)).toMatch(/SameSite=Lax/i);

    // Only the key's hash is stored, never the key; the contact details are snapshotted on the order.
    const row = await h.orderRow(order.id);
    expect(row.guestAccessKeyHash).toBe(sha256(key));
    expect(JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(key);
    expect(row.guestContactName).toBe('Ayesha Khan');
    expect(row.guestContactWhatsapp).toBe('+92 300 1234567');
    expect(row.creditsUsed.toString()).toBe('0');

    // The order belongs to a new guest customer identity for that email (no password).
    const owner = await h.prisma.user.findUniqueOrThrow({ where: { id: row.customerId } });
    expect(owner).toMatchObject({ email: 'ayesha@guest-test.example.com', role: 'customer', isGuest: true, passwordHash: null });

    // The guest cart was converted (active lines cleared), exactly like a signed-in checkout.
    expect((await a.get('/api/cart').expect(200)).body.data.items).toHaveLength(0);

    // Home-page card list + detail for this browser.
    const list = (await a.get('/api/guest-orders').expect(200)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: order.id, status: 'payment_pending', paymentStatus: 'pending', filesUnlocked: false, totalPkr: 1500, amountOutstandingPkr: 1500, itemCount: 1 });
    expect(list[0].items).toEqual([{ name: design.name, sizeLabel: 'Standard', quantity: 1 }]);
    const detail = (await a.get(`/api/guest-orders/${order.id}`).expect(200)).body.data;
    expect(detail.id).toBe(order.id);
    expect(detail.customerId).toBeUndefined();
  });

  it('keeps the order visible across requests (refresh / navigation / reopening) because the key cookie persists', async () => {
    const a = browser();
    const { res, order } = await guestBuy(a);
    expect(setCookieOf(res)).toMatch(/Max-Age=34560000/); // 400 days — survives a browser restart
    // Unrelated navigation never clears it.
    await a.get('/api/cart').expect(200);
    await a.get('/api/designs').expect(200);
    for (let i = 0; i < 3; i++) expect((await a.get('/api/guest-orders').expect(200)).body.data.map((o: any) => o.id)).toEqual([order.id]);
  });

  it('a second guest order from the same browser reuses its key, so both cards show together (newest first)', async () => {
    const a = browser();
    const first = await guestBuy(a);
    const second = await guestBuy(a, { email: 'other-address@guest-test.example.com' });
    expect(second.res.status).toBe(201);
    expect(guestKeyOf(second.res)).toBe(guestKeyOf(first.res));
    const ids = (await a.get('/api/guest-orders').expect(200)).body.data.map((o: any) => o.id);
    expect(ids).toEqual([second.order.id, first.order.id]);
  });

  // ---- 3-5, 9-10: isolation between guests / ids / tokens -----------------------------------------
  it('Guest B (another browser) sees nothing of Guest A — not in the list, not by order id, not its files or receipts', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const paid = await paidGuestOrder(a, admin);
    const b = browser();
    await guestBuy(b, { email: 'bilal@guest-test.example.com' });

    const bList = (await b.get('/api/guest-orders').expect(200)).body.data;
    expect(bList.map((o: any) => o.id)).not.toContain(paid.id);
    expect(bList).toHaveLength(1);

    expect(h.errCode(await b.get(`/api/guest-orders/${paid.id}`).expect(404))).toBe('RESOURCE_NOT_FOUND');
    expect(h.errCode(await b.get(`/api/guest-orders/${paid.id}/files`).expect(404))).toBe('RESOURCE_NOT_FOUND');
    const fileId = (await h.prisma.customerAuthorizedFile.findFirstOrThrow({ where: { orderId: BigInt(paid.id) } })).id.toString();
    expect(h.errCode(await b.post(`/api/guest-orders/${paid.id}/files/${fileId}/download`).expect(404))).toBe('RESOURCE_NOT_FOUND');
    await guestReceipt(b, paid.id).expect(404);
  });

  it('changing the order id in the URL never reaches another order (sequential ids are not authorization)', async () => {
    const a = browser();
    const { order } = await guestBuy(a);
    const b = browser();
    const { order: bOrder } = await guestBuy(b, { email: 'bilal@guest-test.example.com' });
    for (const id of [String(Number(order.id) - 1), String(Number(order.id) + 1), bOrder.id, '0', '-1', '999999999', 'abc', '1 OR 1=1']) {
      if (id === order.id) continue;
      const res = await a.get(`/api/guest-orders/${encodeURIComponent(id)}`);
      expect(res.status).toBe(404);
    }
  });

  it('no cookie, a forged key, a tampered key or a key-shaped guess all match nothing', async () => {
    const a = browser();
    const { res, order } = await guestBuy(a);
    const key = guestKeyOf(res)!;

    // No cookie at all (a visitor who never bought): empty list, not an error.
    expect((await h.http().get('/api/guest-orders').expect(200)).body.data).toEqual([]);
    await h.http().get(`/api/guest-orders/${order.id}`).expect(404);

    const forged = Buffer.alloc(32, 7).toString('base64url');
    for (const bad of [forged, `${key.slice(0, -1)}${key.endsWith('A') ? 'B' : 'A'}`, key.slice(1), `${key}A`, sha256(key), 'null', order.id]) {
      const cookie = `${COOKIE}=${encodeURIComponent(bad)}`;
      expect((await h.http().get('/api/guest-orders').set('Cookie', cookie).expect(200)).body.data).toEqual([]);
      await h.http().get(`/api/guest-orders/${order.id}`).set('Cookie', cookie).expect(404);
    }
    // The real key, presented from anywhere, is what works.
    expect((await h.http().get(`/api/guest-orders/${order.id}`).set('Cookie', `${COOKIE}=${key}`).expect(200)).body.data.id).toBe(order.id);
  });

  it('the email, name or WhatsApp number alone grant nothing — the routes take no such input and signed-in orders never appear', async () => {
    const customer = await h.mkUser('customer');
    const { order: signedIn } = await h.checkout(customer);
    const a = browser();
    await guestBuy(a, { email: customer.email }); // same email as a real account
    const ids = (await a.get('/api/guest-orders').expect(200)).body.data.map((o: any) => o.id);
    expect(ids).not.toContain(signedIn.id); // the account's own order is never visible to the guest key
    await a.get(`/api/guest-orders/${signedIn.id}`).expect(404);
    await h.http().get(`/api/guest-orders?email=${encodeURIComponent(customer.email)}`).expect(200).expect((r) => expect(r.body.data).toEqual([]));
  });

  // ---- 6-8: download security ---------------------------------------------------------------------
  it('unpaid, receipt-pending, rejected (failed) and partially paid guest orders expose no files', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const { order } = await guestBuy(a);
    const locked = async () => {
      const list = await a.get(`/api/guest-orders/${order.id}/files`);
      expect(list.status).toBe(422);
      expect(h.errCode(list)).toBe('PAYMENT_NOT_CONFIRMED');
      const dl = await a.post(`/api/guest-orders/${order.id}/files/1/download`);
      expect(dl.status).toBe(422);
      expect((await a.get(`/api/guest-orders/${order.id}`)).body.data.filesUnlocked).toBe(false);
    };

    await locked(); // unpaid
    await guestReceipt(a, order.id).expect(201);
    await locked(); // receipt awaiting review
    await h.reject(admin, order.id, 'Amount does not match').expect(201);
    await locked(); // payment failed / receipt rejected
    const rejected = (await a.get(`/api/guest-orders/${order.id}`)).body.data;
    expect(rejected.receipts[0]).toMatchObject({ reviewStatus: 'rejected', rejectionReason: 'Amount does not match' });
    await guestReceipt(a, order.id).expect(201);
    await h.approveAmount(admin, order.id, 500).expect(201);
    await locked(); // partial payment
    expect(await h.prisma.customerAuthorizedFile.count({ where: { orderId: BigInt(order.id) } })).toBe(0);
  });

  it('a cancelled guest order never exposes files, and the frontend state cannot change that', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const { order } = await guestBuy(a);
    await h.http().put(`/api/orders/${order.id}/status`).set(h.auth(admin)).send({ status: 'cancelled' }).expect(200);
    expect(h.errCode(await a.get(`/api/guest-orders/${order.id}/files`).expect(422))).toBe('PAYMENT_NOT_CONFIRMED');
    expect(h.errCode(await guestReceipt(a, order.id).expect(409))).toBe('ORDER_NOT_PAYABLE');
    // There is no guest route that can confirm a payment or change a status.
    await a.post(`/api/guest-orders/${order.id}/payment-confirmation`).send({ approve: true }).expect(404);
    await a.put(`/api/guest-orders/${order.id}/status`).send({ status: 'payment_confirmed' }).expect(404);
  });

  it('once Admin confirms 100% payment the guest gets exactly the customer download rights — and never the .EMB file', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const { order, design } = await guestBuy(a);
    // The design also carries an .EMB file (always private — emb_never_public).
    await h.prisma.designFile.create({ data: { designId: design.id, fileFormat: 'EMB', storagePath: '/tmp/x.emb', fileSizeBytes: 10, uploadHash: `emb-${Date.now()}`, isPrivate: true } });

    await guestReceipt(a, order.id).expect(201);
    await h.approve(admin, order.id).expect(201);

    const card = (await a.get('/api/guest-orders').expect(200)).body.data[0];
    expect(card).toMatchObject({ id: order.id, status: 'payment_confirmed', paymentStatus: 'completed', filesUnlocked: true, amountOutstandingPkr: 0 });

    // Release never authorizes the .EMB file at all.
    const rows = await h.prisma.customerAuthorizedFile.findMany({ where: { orderId: BigInt(order.id) }, include: { designFile: true } });
    expect(rows.map((r: any) => r.designFile.fileFormat)).toEqual(['DST']);

    const files = (await a.get(`/api/guest-orders/${order.id}/files`).expect(200)).body.data;
    expect(files.map((f: any) => f.fileFormat)).toEqual(['DST']);
    const dl = (await a.post(`/api/guest-orders/${order.id}/files/${files[0].id}/download`).expect(200)).body.data;
    expect(dl.downloadUrl).toBeTruthy();
    expect(JSON.stringify(files)).not.toMatch(/storagePath|\/tmp\//);

    // Even an authorization row for an .EMB file created some other way is never listed or served.
    const emb = await h.prisma.designFile.findFirstOrThrow({ where: { designId: design.id, fileFormat: 'EMB' } });
    const owner = (await h.orderRow(order.id)).customerId;
    const embRow = await h.prisma.customerAuthorizedFile.create({ data: { orderId: BigInt(order.id), customerId: owner, designFileId: emb.id } });
    expect((await a.get(`/api/guest-orders/${order.id}/files`).expect(200)).body.data.map((f: any) => f.fileFormat)).toEqual(['DST']);
    expect(h.errCode(await a.post(`/api/guest-orders/${order.id}/files/${embRow.id}/download`).expect(422))).toBe('FILE_FORMAT_BLOCKED');
  });

  it('any refund re-locks a guest order’s files, exactly as for a customer', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const order = await paidGuestOrder(a, admin);
    await a.get(`/api/guest-orders/${order.id}/files`).expect(200);
    await h.http().put(`/api/orders/${order.id}/refund`).set(h.auth(admin)).send({ amountPkr: 100, reason: 'test' }).expect(200);
    expect(h.errCode(await a.get(`/api/guest-orders/${order.id}/files`).expect(422))).toBe('PAYMENT_NOT_CONFIRMED');
    expect((await a.get('/api/guest-orders')).body.data[0].filesUnlocked).toBe(false);
  });

  it('the download-attempt limit applies to guests too', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const order = await paidGuestOrder(a, admin);
    const row = await h.prisma.customerAuthorizedFile.findFirstOrThrow({ where: { orderId: BigInt(order.id) } });
    await h.prisma.customerAuthorizedFile.update({ where: { id: row.id }, data: { maxDownloadAttempts: 1 } });
    await a.post(`/api/guest-orders/${order.id}/files/${row.id}/download`).expect(200);
    expect(h.errCode(await a.post(`/api/guest-orders/${order.id}/files/${row.id}/download`).expect(403))).toBe('FORBIDDEN');
  });

  // ---- checkout rules ------------------------------------------------------------------------------
  it('validates the guest details and refuses an empty cart', async () => {
    const a = browser();
    await addDesign(a);
    for (const body of [
      { name: 'X', email: 'not-an-email' },
      { name: '', email: 'x@guest-test.example.com' },
      { email: 'x@guest-test.example.com' },
      { name: 'X', email: 'x@guest-test.example.com', whatsapp: 'call me maybe' },
      { name: 'X', email: 'x@guest-test.example.com', creditsToApplyPkr: 100 }, // not accepted from a guest at all
    ]) {
      expect((await a.post('/api/cart/guest-checkout').send(body)).status).toBe(400);
    }
    expect((await a.get('/api/guest-orders')).body.data).toEqual([]);
    expect(await h.prisma.order.count()).toBe(0);

    const empty = browser();
    expect((await empty.post('/api/cart/guest-checkout').send({ name: 'X', email: 'x@guest-test.example.com' })).status).toBe(400);
    // WhatsApp is optional.
    expect((await a.post('/api/cart/guest-checkout').send({ name: 'X', email: 'x@guest-test.example.com', whatsapp: '' })).status).toBe(201);
  });

  it('guest checkout is rate-limited per IP (anonymous order creation can’t be flooded)', async () => {
    const a = browser();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await a.post('/api/cart/guest-checkout').send({ name: 'X', email: 'x@guest-test.example.com' })).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true); // empty cart, but each attempt counts
    expect(statuses[10]).toBe(429);
  });

  it('a signed-in customer is sent to the normal checkout', async () => {
    const customer = await h.mkUser('customer');
    const res = await h.http().post('/api/cart/guest-checkout').set(h.auth(customer)).send({ name: 'X', email: customer.email });
    expect(res.status).toBe(409);
    expect(h.errCode(res)).toBe('GUEST_CHECKOUT_SIGNED_IN');
  });

  it('an email that belongs to a staff or suspended account must sign in instead', async () => {
    const admin = await h.mkUser('admin');
    const suspended = await h.prisma.user.create({ data: { email: `suspended-${Date.now()}@guest-test.example.com`, role: 'customer', status: 'suspended' } });
    for (const email of [admin.email, suspended.email.toUpperCase()]) {
      const a = browser();
      await addDesign(a);
      const res = await a.post('/api/cart/guest-checkout').send({ name: 'X', email });
      expect(res.status).toBe(409);
      expect(h.errCode(res)).toBe('GUEST_CHECKOUT_SIGN_IN_REQUIRED');
    }
    expect(await h.prisma.order.count()).toBe(0);
  });

  it('an existing customer’s email: the order joins that account, but no credits are spent and the profile is untouched', async () => {
    const customer = await h.prisma.user.create({ data: { email: `Real.Customer-${Date.now()}@guest-test.example.com`, role: 'customer', passwordHash: 'x', displayName: 'Real Name' } });
    await h.grantCredits(customer, 5000);
    const a = browser();
    const { res, order } = await guestBuy(a, { email: customer.email.toLowerCase(), name: 'Someone Else' });
    expect(res.status).toBe(201);

    const row = await h.orderRow(order.id);
    expect(row.customerId).toBe(customer.id); // matched case-insensitively — no duplicate identity
    expect(row.creditsUsed.toString()).toBe('0');
    expect(row.guestContactName).toBe('Someone Else');
    const after = await h.prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after).toMatchObject({ displayName: 'Real Name', isGuest: false, passwordHash: 'x' });
    expect(await h.prisma.user.count({ where: { email: { equals: customer.email, mode: 'insensitive' } } })).toBe(1);

    // The account owner sees it in their normal history once signed in.
    const history = (await h.http().get('/api/orders/user/history').set(h.auth(customer)).expect(200)).body.data;
    expect(history.map((o: any) => o.id)).toContain(order.id);
  });

  // ---- 11: register / sign in after a guest purchase --------------------------------------------
  it('registering with the guest email completes the same identity: orders stay put, nothing is duplicated', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const paid = await paidGuestOrder(a, admin);
    const { order: second } = await guestBuy(a);
    const guestId = (await h.orderRow(paid.id)).customerId;
    const ordersBefore = await h.prisma.order.count();

    await h.http().post('/api/auth/register').send({ email: 'Ayesha@guest-test.example.com', password: 'a-good-password', displayName: 'Ayesha' }).expect(201);

    const user = await h.prisma.user.findUniqueOrThrow({ where: { id: guestId } });
    expect(user.passwordHash).toBeTruthy();
    expect(user.isGuest).toBe(true); // not "signed in" until the emailed new-device code is entered
    expect(await h.prisma.user.count({ where: { email: { equals: 'ayesha@guest-test.example.com', mode: 'insensitive' } } })).toBe(1);
    expect(await h.prisma.order.count()).toBe(ordersBefore);
    expect((await h.prisma.order.findMany({ where: { customerId: guestId } })).map((o: any) => o.id.toString()).sort()).toEqual([paid.id, second.id].sort());

    // Registering the same email again is the ordinary "already registered".
    expect(h.errCode(await h.http().post('/api/auth/register').send({ email: 'ayesha@guest-test.example.com', password: 'another-password' }).expect(409))).toBe('EMAIL_ALREADY_REGISTERED');

    // The guest browser still sees its orders.
    expect((await a.get('/api/guest-orders')).body.data).toHaveLength(2);

    // Once signed in (tokens are only ever issued after the emailed proof), the identity is an
    // ordinary account, its history holds both orders, and the paid one's files work as usual.
    const { AuthService } = await import('../../src/auth/auth.service');
    await (h.app.get(AuthService) as any).issueTokens(user, 'session-x', 'device-x');
    const signedIn = await h.prisma.user.findUniqueOrThrow({ where: { id: guestId } });
    expect(signedIn.isGuest).toBe(false);
    const history = (await h.http().get('/api/orders/user/history').set(h.auth(signedIn)).expect(200)).body.data.map((o: any) => o.id);
    expect(history.sort()).toEqual([paid.id, second.id].sort());
    await h.http().get(`/api/orders/${paid.id}/files`).set(h.auth(signedIn)).expect(200);
  });

  it('a guest identity cannot be signed in to with a password it never had', async () => {
    const a = browser();
    await guestBuy(a);
    const res = await h.http().post('/api/auth/login').send({ email: 'ayesha@guest-test.example.com', password: 'anything-at-all' });
    expect(res.status).toBe(401);
    expect(h.errCode(res)).toBe('UNAUTHENTICATED');
  });

  // ---- registered customers keep working ---------------------------------------------------------
  it('a signed-in customer’s checkout, history and files are unchanged (and their orders never carry a guest key)', async () => {
    const admin = await h.mkUser('admin');
    const customer = await h.mkUser('customer');
    const order = await h.bankOrderWithReceipt(customer);
    await h.approve(admin, order.id).expect(201);

    const row = await h.orderRow(order.id);
    expect(row.guestAccessKeyHash).toBeNull();
    const history = (await h.http().get('/api/orders/user/history?page=1&pageSize=5').set(h.auth(customer)).expect(200)).body.data;
    expect(history[0]).toMatchObject({ id: order.id, status: 'payment_confirmed', filesUnlocked: true, amountOutstandingPkr: 0, itemCount: 1 });
    expect(history[0].items[0]).toMatchObject({ quantity: 1, sizeLabel: 'Standard' });
    expect((await h.http().get(`/api/orders/${order.id}`).set(h.auth(customer)).expect(200)).body.data.customerId).toBe(customer.id.toString());
    const files = (await h.http().get(`/api/orders/${order.id}/files`).set(h.auth(customer)).expect(200)).body.data;
    await h.http().post(`/api/orders/${order.id}/files/${files[0].id}/download`).set(h.auth(customer)).expect(200);
    // A guest key can't see it, and the customer's token can't use guest routes to see others' orders.
    expect((await h.http().get('/api/guest-orders').set(h.auth(customer)).expect(200)).body.data).toEqual([]);
  });

  it('Admin sees which orders were placed as a guest, with the contact details typed at checkout', async () => {
    const admin = await h.mkUser('admin');
    const a = browser();
    const { order } = await guestBuy(a);
    const customer = await h.mkUser('customer');
    const { order: normal } = await h.checkout(customer);
    const rows = (await h.http().get('/api/orders').set(h.auth(admin)).expect(200)).body.data;
    expect(rows.find((r: any) => r.id === order.id)).toMatchObject({ placedAsGuest: true, guestContactName: 'Ayesha Khan', guestContactWhatsapp: '+92 300 1234567', customerEmail: 'ayesha@guest-test.example.com' });
    expect(rows.find((r: any) => r.id === normal.id)).toMatchObject({ placedAsGuest: false, guestContactName: null });
  });
});
