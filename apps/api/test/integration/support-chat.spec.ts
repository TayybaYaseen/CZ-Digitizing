import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { Role, User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { SupportChatNotifierService } from '../../src/support-chat/support-chat-notifier.service';

// socket.io-client is already a workspace dependency (apps/web, apps/admin, apps/mobile); resolved from
// apps/web rather than adding it to apps/api's package.json for one test file.
// The slice of the socket.io-client API this spec uses (apps/api has no dependency on its types).
interface ClientSocket {
  on(event: string, listener: (...args: never[]) => void): ClientSocket;
  once(event: string, listener: (...args: never[]) => void): ClientSocket;
  disconnect(): ClientSocket;
  timeout(ms: number): { emitWithAck(event: string, payload: unknown): Promise<unknown> };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { io } = require(require.resolve('socket.io-client', { paths: [join(__dirname, '../../../web')] })) as {
  io: (url: string, options: Record<string, unknown>) => ClientSocket;
};

// docs/specs/2026-10-06-21-customer-admin-live-chat.md (aspect A-025) §33.
//
// SAFETY: run only against a throwaway database (name must contain "test"), e.g.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_livechat_test pnpm --filter @czd/api test:integration -- support-chat
// This spec only deletes rows it created (users under @support-chat-test.example.com, cascading).
const DOMAIN = '@support-chat-test.example.com';

describe('Customer ↔ Admin Live Chat (docs/specs/2026-10-06-21-customer-admin-live-chat.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let notifier: SupportChatNotifierService;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL ?? '';
    if (!/test/i.test(new URL(dbUrl).pathname)) throw new Error(`Refusing to run against a non-test database: ${new URL(dbUrl).pathname}`);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    notifier = app.get(SupportChatNotifierService);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  beforeEach(async () => {
    await cleanUp();
    // Rate-limit counters live in the (mock) Redis and would otherwise accumulate across tests.
    await app.get(RedisService).client.flushall();
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()?.disconnect();
  });

  async function cleanUp() {
    // Conversations cascade from the customer; delete them first so SetNull on staff senders doesn't matter.
    await prisma.supportConversation.deleteMany({ where: { customer: { email: { endsWith: DOMAIN } } } });
    await prisma.order.deleteMany({ where: { customer: { email: { endsWith: DOMAIN } } } });
    await prisma.notification.deleteMany({ where: { recipient: { email: { endsWith: DOMAIN } } } });
    await prisma.auditLog.deleteMany({ where: { resourceType: 'support_conversation' } });
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  }

  async function createUser(role: Role, permission?: 'read_only' | 'crud'): Promise<User> {
    const user = await prisma.user.create({ data: { email: `${role}-${randomUUID()}${DOMAIN}`, role, displayName: `${role} user` } });
    if (permission) await prisma.adminPermission.create({ data: { userId: user.id, module: 'support_chat', accessLevel: permission } });
    return user;
  }

  function tokenFor(user: User): string {
    return tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
  }

  function auth(user: User) {
    return { Authorization: `Bearer ${tokenFor(user)}` };
  }

  const http = () => request(app.getHttpServer());

  function start(customer: User, body = 'Hello, I need help', extra: Record<string, unknown> = {}) {
    return http()
      .post('/api/support/conversations')
      .set(auth(customer))
      .send({ clientMessageId: randomUUID(), body, ...extra });
  }

  function adminReply(admin: User, conversationId: string, body = 'Happy to help') {
    return http().post(`/api/admin/support/conversations/${conversationId}/messages`).set(auth(admin)).send({ clientMessageId: randomUUID(), body });
  }

  function connect(user: User, token = tokenFor(user)): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/support-chat`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err: Error) => reject(err));
    });
  }

  function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
    return socket.timeout(3000).emitWithAck(event, payload) as Promise<T>;
  }

  function nextEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  function collect(socket: ClientSocket, event: string): unknown[] {
    const seen: unknown[] = [];
    socket.on(event, (data: unknown) => seen.push(data));
    return seen;
  }

  const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------------------------------------------
  // Customer
  // ------------------------------------------------------------------------------------------

  it('AC-1: a customer starts a general conversation; it is open and shows in the Admin list with 1 unread', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');

    const res = await start(customer).expect(201);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.conversation).toMatchObject({ context: { type: 'general', id: null }, isResolved: false, unreadCount: 0, lastMessageFromMe: true });
    expect(res.body.data.message).toMatchObject({ senderType: 'customer', body: 'Hello, I need help' });
    expect(res.body.data.conversation).not.toHaveProperty('status');

    const list = await http().get('/api/admin/support/conversations?status=open').set(auth(admin)).expect(200);
    const row = list.body.data.find((c: { id: string }) => c.id === res.body.data.conversation.id);
    expect(row).toMatchObject({ status: 'open', unreadCount: 1, lastMessageSenderType: 'customer', customer: { email: customer.email } });

    await http().get('/api/admin/support/unread-count').set(auth(admin)).expect(200);
  });

  it('AC-2/AC-19: starting from an owned order links it and reuses the active conversation; a foreign order is 404', async () => {
    const customer = await createUser('customer');
    const other = await createUser('customer');
    const order = await prisma.order.create({ data: { customerId: customer.id, paymentMethod: 'bank_transfer', totalPkr: 2500 } });

    const first = await start(customer, 'About my order', { contextType: 'order', contextId: order.id.toString() }).expect(201);
    expect(first.body.data.conversation.context).toEqual({ type: 'order', id: order.id.toString(), label: order.id.toString() });

    const again = await start(customer, 'Another question about it', { contextType: 'order', contextId: order.id.toString() }).expect(200);
    expect(again.body.data.created).toBe(false);
    expect(again.body.data.conversation.id).toBe(first.body.data.conversation.id);

    // A general conversation is separate from the order one.
    const general = await start(customer, 'General question').expect(201);
    expect(general.body.data.conversation.id).not.toBe(first.body.data.conversation.id);

    await start(other, 'Not my order', { contextType: 'order', contextId: order.id.toString() }).expect(404);
    expect(await prisma.supportConversation.count({ where: { customerId: other.id } })).toBe(0);

    await start(customer, 'x', { contextType: 'order' }).expect(400);
  });

  it('§11.6: a retried send with the same clientMessageId stores one row and returns the original', async () => {
    const customer = await createUser('customer');
    const started = await start(customer).expect(201);
    const id = started.body.data.conversation.id;
    const clientMessageId = randomUUID();

    const [a, b] = await Promise.all([
      http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId, body: 'retry me' }),
      http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId, body: 'retry me' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.supportMessage.count({ where: { conversationId: BigInt(id), clientMessageId } })).toBe(1);

    // A retried *start* is idempotent too.
    const startId = randomUUID();
    const s1 = await http().post('/api/support/conversations').set(auth(customer)).send({ clientMessageId: startId, body: 'hi again' });
    const s2 = await http().post('/api/support/conversations').set(auth(customer)).send({ clientMessageId: startId, body: 'hi again' }).expect(200);
    expect(s2.body.data.message.id).toBe(s1.body.data.message.id);
  });

  it('concurrent starts for the same context create exactly one conversation', async () => {
    const customer = await createUser('customer');
    const results = await Promise.all([start(customer, 'one'), start(customer, 'two'), start(customer, 'three')]);
    const ids = new Set(results.map((r) => r.body.data.conversation.id));
    expect(ids.size).toBe(1);
    expect(await prisma.supportConversation.count({ where: { customerId: customer.id } })).toBe(1);
    expect(await prisma.supportMessage.count({ where: { conversation: { customerId: customer.id } } })).toBe(3);
  });

  it('AC-5/AC-6/AC-12: history, unread counts, reading clears unread + the notification, and "Seen" pointers', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const id = (await start(customer)).body.data.conversation.id;

    const r1 = await adminReply(admin, id, 'reply one').expect(201);
    await adminReply(admin, id, 'reply two').expect(201);
    await notifier.settled(BigInt(id));

    const summary = await http().get(`/api/support/conversations/${id}`).set(auth(customer)).expect(200);
    expect(summary.body.data.unreadCount).toBe(2);
    expect((await http().get('/api/support/unread-count').set(auth(customer))).body.data.total).toBe(2);

    // One notification for the burst (§17.3).
    expect(await prisma.notification.count({ where: { recipientUserId: customer.id, notificationType: 'support_reply', isRead: false } })).toBe(1);

    const messages = await http().get(`/api/support/conversations/${id}/messages`).set(auth(customer)).expect(200);
    expect(messages.body.data.map((m: { body: string }) => m.body)).toEqual(['Hello, I need help', 'reply one', 'reply two']);
    const lastId = messages.body.data[2].id;

    const read = await http().post(`/api/support/conversations/${id}/read`).set(auth(customer)).send({ upToMessageId: lastId }).expect(200);
    expect(read.body.data).toEqual({ unreadCount: 0, totalUnread: 0 });
    expect(await prisma.notification.count({ where: { recipientUserId: customer.id, notificationType: 'support_reply', isRead: false } })).toBe(0);

    // Pointer never moves backwards.
    await http().post(`/api/support/conversations/${id}/read`).set(auth(customer)).send({ upToMessageId: r1.body.data.id }).expect(200);
    const adminView = await http().get(`/api/admin/support/conversations/${id}`).set(auth(admin)).expect(200);
    expect(adminView.body.data.customerLastReadMessageId).toBe(lastId);

    // After reading, the next reply notifies again.
    await adminReply(admin, id, 'reply three').expect(201);
    await notifier.settled(BigInt(id));
    expect(await prisma.notification.count({ where: { recipientUserId: customer.id, notificationType: 'support_reply', isRead: false } })).toBe(1);
  }, 60_000);

  it('AC-24: messages page by cursor (before/after) with hasMore', async () => {
    const customer = await createUser('customer');
    const id = (await start(customer, 'm0')).body.data.conversation.id;
    for (let i = 1; i < 7; i += 1) {
      await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: `m${i}` }).expect(201);
    }
    const newest = await http().get(`/api/support/conversations/${id}/messages?limit=3`).set(auth(customer)).expect(200);
    expect(newest.body.data.map((m: { body: string }) => m.body)).toEqual(['m4', 'm5', 'm6']);
    expect(newest.body.meta.hasMore).toBe(true);

    const older = await http().get(`/api/support/conversations/${id}/messages?limit=3&before=${newest.body.data[0].id}`).set(auth(customer)).expect(200);
    expect(older.body.data.map((m: { body: string }) => m.body)).toEqual(['m1', 'm2', 'm3']);

    const oldest = await http().get(`/api/support/conversations/${id}/messages?limit=3&before=${older.body.data[0].id}`).set(auth(customer)).expect(200);
    expect(oldest.body.data.map((m: { body: string }) => m.body)).toEqual(['m0']);
    expect(oldest.body.meta.hasMore).toBe(false);

    const gap = await http().get(`/api/support/conversations/${id}/messages?after=${older.body.data[0].id}&limit=2`).set(auth(customer)).expect(200);
    expect(gap.body.data.map((m: { body: string }) => m.body)).toEqual(['m2', 'm3']);
    expect(gap.body.meta.hasMore).toBe(true);

    await http().get(`/api/support/conversations/${id}/messages?after=1&before=2`).set(auth(customer)).expect(400);
  });

  it('AC-8/AC-13: status changes write a system line + audit row; customer reply reopens; Admin reply to resolved → pending', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const id = (await start(customer)).body.data.conversation.id;

    const resolved = await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(admin)).send({ status: 'resolved' }).expect(200);
    expect(resolved.body.data).toMatchObject({ status: 'resolved', statusChangedBy: { id: admin.id.toString() } });
    expect(await prisma.auditLog.count({ where: { resourceType: 'support_conversation', resourceId: id, actionType: 'SUPPORT_CONVERSATION_STATUS_CHANGED' } })).toBe(1);

    const adminMessages = await http().get(`/api/admin/support/conversations/${id}/messages`).set(auth(admin)).expect(200);
    expect(adminMessages.body.data.at(-1)).toMatchObject({ senderType: 'system', body: 'Status changed to Resolved', sender: { id: admin.id.toString() } });

    // Customers never see system lines; they see isResolved.
    const customerMessages = await http().get(`/api/support/conversations/${id}/messages`).set(auth(customer)).expect(200);
    expect(customerMessages.body.data.every((m: { senderType: string }) => m.senderType !== 'system')).toBe(true);
    expect((await http().get(`/api/support/conversations/${id}`).set(auth(customer))).body.data.isResolved).toBe(true);

    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'one more thing' }).expect(201);
    expect((await prisma.supportConversation.findUniqueOrThrow({ where: { id: BigInt(id) } })).status).toBe('open');

    await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(admin)).send({ status: 'resolved' }).expect(200);
    await adminReply(admin, id, 'following up').expect(201);
    expect((await prisma.supportConversation.findUniqueOrThrow({ where: { id: BigInt(id) } })).status).toBe('pending');

    await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(admin)).send({ status: 'closed' }).expect(400);
  });

  it('AC-8: reopening a resolved conversation while another is active for the same context → 409 with the active id', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const oldId = (await start(customer, 'first')).body.data.conversation.id;
    await http().patch(`/api/admin/support/conversations/${oldId}/status`).set(auth(admin)).send({ status: 'resolved' }).expect(200);
    const newId = (await start(customer, 'second')).body.data.conversation.id;
    expect(newId).not.toBe(oldId);

    const res = await http().post(`/api/support/conversations/${oldId}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'reopen?' }).expect(409);
    expect(res.body.code ?? res.body.error?.code).toBeDefined();
    expect(JSON.stringify(res.body)).toContain('CONVERSATION_ALREADY_OPEN');
    expect(JSON.stringify(res.body)).toContain(newId);

    await http().patch(`/api/admin/support/conversations/${oldId}/status`).set(auth(admin)).send({ status: 'open' }).expect(409);
  });

  it('AC-10: admin search and filters', async () => {
    const admin = await createUser('admin');
    const ayesha = await prisma.user.create({ data: { email: `ayesha-${randomUUID()}${DOMAIN}`, role: 'customer', displayName: 'Ayesha Khan' } });
    const bilal = await prisma.user.create({ data: { email: `bilal-${randomUUID()}${DOMAIN}`, role: 'customer', displayName: 'Bilal R' } });
    const order = await prisma.order.create({ data: { customerId: bilal.id, paymentMethod: 'bank_transfer', totalPkr: 100, bankTransferReference: `CZ-${Date.now()}` } });

    const a = (await start(ayesha, 'general q')).body.data.conversation.id;
    const b = (await start(bilal, 'order q', { contextType: 'order', contextId: order.id.toString() })).body.data.conversation.id;
    await adminReply(admin, b).expect(201); // b now read by admin

    const ids = async (qs: string) => (await http().get(`/api/admin/support/conversations?${qs}`).set(auth(admin)).expect(200)).body.data.map((c: { id: string }) => c.id);

    expect(await ids('q=ayesha')).toEqual([a]);
    expect(await ids(`q=${encodeURIComponent('#' + order.id)}`)).toContain(b);
    expect(await ids(`q=${order.bankTransferReference}`)).toEqual([b]);
    expect(await ids(`q=%23${a}`)).toContain(a);
    expect(await ids('contextType=order&q=support-chat-test')).toEqual([b]);
    const unread = await ids('unread=true&q=support-chat-test');
    expect(unread).toContain(a);
    expect(unread).not.toContain(b);
    expect(await ids('status=resolved&q=support-chat-test')).toEqual([]);

    const detail = await http().get(`/api/admin/support/conversations/${b}`).set(auth(admin)).expect(200);
    expect(detail.body.data.customerInfo).toMatchObject({ email: bilal.email, displayName: 'Bilal R', counts: { orders: 1, openConversations: 1 }, adminProfileHref: `/customers/${bilal.id}` });
    expect(detail.body.data.contextCard).toMatchObject({ type: 'order', id: order.id.toString(), status: 'pending', reference: order.bankTransferReference, adminHref: `/orders/${order.id}`, available: true });
  });

  it('context deleted later: the transcript survives and the card says unavailable', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const order = await prisma.order.create({ data: { customerId: customer.id, paymentMethod: 'bank_transfer', totalPkr: 100 } });
    const id = (await start(customer, 'about it', { contextType: 'order', contextId: order.id.toString() })).body.data.conversation.id;
    await prisma.order.delete({ where: { id: order.id } });

    const detail = await http().get(`/api/admin/support/conversations/${id}`).set(auth(admin)).expect(200);
    expect(detail.body.data.context).toEqual({ type: 'order', id: null, label: null });
    expect(detail.body.data.contextCard).toMatchObject({ available: false });
    expect((await http().get(`/api/support/conversations/${id}/messages`).set(auth(customer)).expect(200)).body.data).toHaveLength(1);
  });

  // ------------------------------------------------------------------------------------------
  // Security
  // ------------------------------------------------------------------------------------------

  it('AC-15: customer B gets the same 404 as a non-existent id for every route on A’s conversation', async () => {
    const a = await createUser('customer');
    const b = await createUser('customer');
    const id = (await start(a)).body.data.conversation.id;
    const missing = '999999999999';

    for (const target of [id, missing]) {
      const get = await http().get(`/api/support/conversations/${target}`).set(auth(b)).expect(404);
      expect(get.body.message ?? get.body.error?.message).toBeDefined();
      await http().get(`/api/support/conversations/${target}/messages`).set(auth(b)).expect(404);
      await http().post(`/api/support/conversations/${target}/messages`).set(auth(b)).send({ clientMessageId: randomUUID(), body: 'x' }).expect(404);
      await http().post(`/api/support/conversations/${target}/read`).set(auth(b)).send({ upToMessageId: '1' }).expect(404);
    }
    const list = await http().get('/api/support/conversations').set(auth(b)).expect(200);
    expect(list.body.data).toEqual([]);
    await http().get('/api/support/conversations/not-a-number').set(auth(b)).expect(404);
  });

  it('AC-16/AC-17: customers and unpermitted staff are refused on admin routes; read_only cannot reply or change status', async () => {
    const customer = await createUser('customer');
    const id = (await start(customer)).body.data.conversation.id;
    const noPerm = await createUser('freelancer');
    const reader = await createUser('moderator', 'read_only');
    const writer = await createUser('freelancer', 'crud');

    await http().get('/api/admin/support/conversations').set(auth(customer)).expect(403);
    await http().get('/api/admin/support/conversations').set(auth(noPerm)).expect(403);
    await http().get('/api/admin/support/conversations').expect(401);

    await http().get(`/api/admin/support/conversations/${id}`).set(auth(reader)).expect(200);
    await adminReply(reader, id).expect(403);
    await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(reader)).send({ status: 'pending' }).expect(403);

    await adminReply(writer, id).expect(201);
    await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(writer)).send({ status: 'pending' }).expect(200);

    // Staff can't use the customer routes.
    await http().get('/api/support/conversations').set(auth(writer)).expect(403);
  });

  it('AC-14: a customer message notifies admins and permitted staff once, but not unpermitted staff', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const permitted = await createUser('moderator', 'read_only');
    const unpermitted = await createUser('freelancer');
    const id = (await start(customer)).body.data.conversation.id;
    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'and another' }).expect(201);
    await notifier.settled(BigInt(id));

    const count = (u: User) => prisma.notification.count({ where: { recipientUserId: u.id, notificationType: 'support_message', relatedSupportConversationId: BigInt(id) } });
    expect(await count(admin)).toBe(1);
    expect(await count(permitted)).toBe(1);
    expect(await count(unpermitted)).toBe(0);
  }, 60_000);

  it('AC-20: HTML is stored as literal text, control characters stripped, over-length and empty rejected, extra fields rejected', async () => {
    const customer = await createUser('customer');
    const res = await start(customer, '<img src=x onerror=alert(1)>\u0007hi').expect(201);
    expect(res.body.data.message.body).toBe('<img src=x onerror=alert(1)>hi');
    const id = res.body.data.conversation.id;

    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'x'.repeat(4001) }).expect(400);
    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: '   ' }).expect(400);
    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: 'not-a-uuid', body: 'x' }).expect(400);
    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'x', senderType: 'admin' }).expect(400);
  });

  it('AC-20: sending faster than the per-user limit returns RATE_LIMITED', async () => {
    const customer = await createUser('customer');
    const id = (await start(customer)).body.data.conversation.id;
    let limited = 0;
    for (let i = 0; i < 32; i += 1) {
      const res = await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: `msg ${i}` });
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it('§28.8: a suspended customer can read but not send', async () => {
    const customer = await createUser('customer');
    const id = (await start(customer)).body.data.conversation.id;
    await prisma.user.update({ where: { id: customer.id }, data: { status: 'suspended' } });
    await http().get(`/api/support/conversations/${id}/messages`).set(auth(customer)).expect(200);
    await http().post(`/api/support/conversations/${id}/messages`).set(auth(customer)).send({ clientMessageId: randomUUID(), body: 'x' }).expect(403);
  });

  // ------------------------------------------------------------------------------------------
  // Socket.IO
  // ------------------------------------------------------------------------------------------

  it('AC-18: the socket rejects missing, invalid and expired tokens, and staff without permission', async () => {
    const customer = await createUser('customer');
    const noPerm = await createUser('freelancer');
    await expect(connect(customer, '')).rejects.toThrow();
    await expect(connect(customer, 'garbage')).rejects.toThrow();

    const expired = new JwtService().sign(
      { sub: customer.id.toString(), email: customer.email, role: 'customer', device_id: 'd', permissions: [] },
      { secret: app.get(ConfigService).get('JWT_ACCESS_SECRET'), expiresIn: -10 },
    );
    await expect(connect(customer, expired)).rejects.toThrow();
    await expect(connect(noPerm)).rejects.toThrow(/FORBIDDEN/);
  });

  it('AC-18: the server disconnects a socket when its token expires', async () => {
    const customer = await createUser('customer');
    const shortLived = new JwtService().sign(
      { sub: customer.id.toString(), email: customer.email, role: 'customer', device_id: 'd', permissions: [] },
      { secret: app.get(ConfigService).get('JWT_ACCESS_SECRET'), expiresIn: 2 },
    );
    const socket = await connect(customer, shortLived);
    const reason = await nextEvent<string>(socket, 'disconnect', 4000);
    expect(reason).toBe('io server disconnect');
  });

  it('AC-15: a customer cannot join another customer’s conversation and receives none of its events', async () => {
    const a = await createUser('customer');
    const b = await createUser('customer');
    const admin = await createUser('admin');
    const id = (await start(a)).body.data.conversation.id;

    const sb = await connect(b);
    const seen = [...['message', 'typing', 'read', 'conversation-updated'].map((e) => collect(sb, e))];
    expect(await emitAck(sb, 'join', { conversationId: id })).toEqual({ ok: false, code: 'RESOURCE_NOT_FOUND' });
    expect(await emitAck(sb, 'join', { conversationId: '999999999' })).toEqual({ ok: false, code: 'RESOURCE_NOT_FOUND' });
    expect(await emitAck(sb, 'typing', { conversationId: id, isTyping: true })).toEqual({ ok: false, code: 'RESOURCE_NOT_FOUND' });

    await adminReply(admin, id).expect(201);
    await settle();
    expect(seen.flat()).toHaveLength(0);
  });

  it('AC-3/AC-25: live delivery reaches only the right audiences with the right shapes; viewing suppresses the notification', async () => {
    const customer = await createUser('customer');
    const otherCustomer = await createUser('customer');
    const admin = await createUser('admin');
    const id = (await start(customer)).body.data.conversation.id;

    const cs = await connect(customer);
    const as = await connect(admin);
    const bystander = await connect(otherCustomer);
    const bystanderEvents = collect(bystander, 'message');

    expect(await emitAck(cs, 'join', { conversationId: id })).toEqual({ ok: true });
    expect(await emitAck(cs, 'viewing', { conversationId: id, visible: true })).toEqual({ ok: true });
    expect(await emitAck(as, 'join', { conversationId: id })).toEqual({ ok: true });

    const customerGot = nextEvent<Record<string, unknown>>(cs, 'message');
    const adminGot = nextEvent<Record<string, unknown>>(as, 'message');
    const staffList = nextEvent<Record<string, unknown>>(as, 'conversation-updated');
    const reply = await adminReply(admin, id, 'live reply').expect(201);

    const c = await customerGot;
    const a = await adminGot;
    expect(c).toEqual({ id: reply.body.data.id, conversationId: id, senderType: 'admin', body: 'live reply', clientMessageId: expect.any(String), createdAt: expect.any(String) });
    expect(c).not.toHaveProperty('sender');
    expect(a).toMatchObject({ id: reply.body.data.id, sender: { id: admin.id.toString() } });
    expect(await staffList).toMatchObject({ id, status: 'open' });

    await notifier.settled(BigInt(id));
    expect(await prisma.notification.count({ where: { recipientUserId: customer.id, notificationType: 'support_reply' } })).toBe(0);
    await settle();
    expect(bystanderEvents).toHaveLength(0);

    // Typing is relayed to the other side without identity; read receipts flow to the admin.
    const typing = nextEvent<Record<string, unknown>>(as, 'typing');
    await emitAck(cs, 'typing', { conversationId: id, isTyping: true });
    expect(await typing).toEqual({ conversationId: id, side: 'customer', isTyping: true });

    const typingToCustomer = nextEvent<Record<string, unknown>>(cs, 'typing');
    await emitAck(as, 'typing', { conversationId: id, isTyping: true });
    expect(await typingToCustomer).toEqual({ conversationId: id, side: 'support', isTyping: true });

    const readEvent = nextEvent<Record<string, unknown>>(as, 'read');
    await http().post(`/api/support/conversations/${id}/read`).set(auth(customer)).send({ upToMessageId: reply.body.data.id }).expect(200);
    expect(await readEvent).toMatchObject({ conversationId: id, side: 'customer', lastReadMessageId: reply.body.data.id });

    // Status changes: the customer only learns "resolved"; system lines go to staff only.
    const customerUpdate = nextEvent<Record<string, unknown>>(cs, 'conversation-updated');
    const staffSystem = nextEvent<Record<string, unknown>>(as, 'message');
    const customerMessages = collect(cs, 'message');
    await http().patch(`/api/admin/support/conversations/${id}/status`).set(auth(admin)).send({ status: 'resolved' }).expect(200);
    expect(await customerUpdate).toMatchObject({ id, isResolved: true });
    expect((await customerUpdate)).not.toHaveProperty('status');
    expect(await staffSystem).toMatchObject({ senderType: 'system' });
    await settle();
    expect(customerMessages).toHaveLength(0);
  });

  it('AC-7: after a disconnect, the gap is filled exactly once via after=<lastId>', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    const started = await start(customer);
    const id = started.body.data.conversation.id;
    const lastKnown = started.body.data.message.id;

    const socket = await connect(customer);
    socket.disconnect();
    await adminReply(admin, id, 'while you were away 1').expect(201);
    await adminReply(admin, id, 'while you were away 2').expect(201);

    const reconnected = await connect(customer);
    expect(await emitAck(reconnected, 'join', { conversationId: id })).toEqual({ ok: true });
    const gap = await http().get(`/api/support/conversations/${id}/messages?after=${lastKnown}`).set(auth(customer)).expect(200);
    expect(gap.body.data.map((m: { body: string }) => m.body)).toEqual(['while you were away 1', 'while you were away 2']);
  });

  it('AC-17: a staff socket whose permission is revoked is refused at the next join', async () => {
    const customer = await createUser('customer');
    const staff = await createUser('moderator', 'read_only');
    const id = (await start(customer)).body.data.conversation.id;
    const socket = await connect(staff);
    await prisma.adminPermission.updateMany({ where: { userId: staff.id }, data: { revokedAt: new Date() } });
    expect(await emitAck(socket, 'join', { conversationId: id })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});
