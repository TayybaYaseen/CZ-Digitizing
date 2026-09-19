/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Design, DesignSize, User } from '../../../src/generated/prisma';

// Shared harness for the A-013 (Orders & Payment Processing) integration/e2e specs.
//
// SAFETY: these specs TRUNCATE users/designs/exchange_rates/payment_method_settings (cascading to
// orders, carts, receipts, ...). createOrdersHarness() therefore refuses to start unless
// DATABASE_URL names a throwaway database (its name must contain "test" or "audit"). Create one
// and run migrations first, e.g.
//   createdb czd_a013_test && DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_test \
//     pnpm --filter @czd/api exec prisma migrate deploy
//   DATABASE_URL=... pnpm --filter @czd/api test:integration -- orders
//
// PayPal and Stripe are FAKED at the network boundary only: FakePayPal scripts PayPal's REST API
// (there are no real sandbox credentials in this repo) and FakeStripe replaces the Stripe SDK's
// paymentIntents.create/retrieve calls — but Stripe webhook signatures are verified by the REAL
// Stripe SDK (constructEvent / generateTestHeaderString), and every PayPal/Stripe call the app makes
// is recorded so tests assert exactly what was SENT to the provider.

const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
export const STRIPE_WEBHOOK_SECRET = 'whsec_orders_test';
export const USD_RATE = 278.5; // 1 USD = 278.5 PKR (ExchangeRateService's built-in fallback table)

export const tinyPng = (): Buffer =>
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const tinyPdf = (): Buffer => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

export interface FakePayPalOrder {
  id: string;
  referenceId: string;
  currency: string;
  value: string;
  status: 'PAYER_ACTION_REQUIRED' | 'APPROVED' | 'COMPLETED' | 'VOIDED';
  captures: { id: string; status: string; currency: string; value: string }[];
}

export class FakePayPal {
  orders = new Map<string, FakePayPalOrder>();
  calls: { url: string; method: string; headers: Record<string, string>; body: any }[] = [];
  seq = 0;
  // Flip to make PayPal answer FAILURE to verify-webhook-signature.
  signatureValid = true;
  // Make PayPal capture something different from what the order was for (simulates a mismatch).
  captureOverride: { currency?: string; value?: string } | null = null;
  // Make order creation fail (PayPal outage).
  failCreate = false;
  private spy: jest.SpyInstance | null = null;
  private readonly realFetch = (global as any).fetch as typeof fetch;

  install(): void {
    this.spy = jest.spyOn(global as any, 'fetch').mockImplementation((async (url: any, init?: any) => {
      const u = String(url);
      if (!u.startsWith(PAYPAL_BASE)) return this.realFetch(url, init);
      const raw = init?.body;
      const body = typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : raw;
      const method = String(init?.method ?? 'GET').toUpperCase();
      this.calls.push({ url: u, method, headers: (init?.headers ?? {}) as Record<string, string>, body });
      return this.route(u.slice(PAYPAL_BASE.length), method, body);
    }) as any);
  }

  reset(): void {
    this.orders.clear();
    this.calls = [];
    this.seq = 0;
    this.signatureValid = true;
    this.captureOverride = null;
    this.failCreate = false;
  }

  uninstall(): void {
    this.spy?.mockRestore();
  }

  callsTo(pathSuffix: string, method?: string) {
    return this.calls.filter((c) => c.url.endsWith(pathSuffix) && (!method || c.method === method));
  }

  // The buyer approving the payment on PayPal's site.
  approve(paypalOrderId: string): void {
    const order = this.orders.get(paypalOrderId);
    if (!order) throw new Error(`no fake PayPal order ${paypalOrderId}`);
    order.status = 'APPROVED';
  }

  private json(status: number, body: unknown): Response {
    return { ok: status < 400, status, json: async () => body } as Response;
  }

  private route(path: string, method: string, body: any): Response {
    if (path === '/v1/oauth2/token') return this.json(200, { access_token: 'fake-token' });

    if (path === '/v1/notifications/verify-webhook-signature') return this.json(200, { verification_status: this.signatureValid ? 'SUCCESS' : 'FAILURE' });

    if (method === 'POST' && path === '/v2/checkout/orders') {
      if (this.failCreate) return this.json(500, { name: 'INTERNAL_SERVER_ERROR' });
      const unit = body.purchase_units[0];
      const id = `PP-ORDER-${++this.seq}`;
      this.orders.set(id, { id, referenceId: unit.reference_id, currency: unit.amount.currency_code, value: unit.amount.value, status: 'PAYER_ACTION_REQUIRED', captures: [] });
      return this.json(201, { id, status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: `https://paypal.fake/approve/${id}` }] });
    }

    const match = /^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/.exec(path);
    if (match) {
      const order = this.orders.get(match[1]);
      if (!order) return this.json(404, { name: 'RESOURCE_NOT_FOUND' });
      if (match[2] && method === 'POST') {
        if (order.status === 'COMPLETED') return this.json(422, { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] });
        if (order.status !== 'APPROVED') return this.json(422, { details: [{ issue: 'ORDER_NOT_APPROVED' }] });
        order.status = 'COMPLETED';
        order.captures.push({ id: `CAP-${order.id}`, status: 'COMPLETED', currency: this.captureOverride?.currency ?? order.currency, value: this.captureOverride?.value ?? order.value });
        return this.json(201, this.view(order));
      }
      if (method === 'GET') return this.json(200, this.view(order));
    }
    return this.json(404, { name: 'NOT_FOUND', path });
  }

  private view(order: FakePayPalOrder) {
    return {
      id: order.id,
      status: order.status,
      links: order.status === 'PAYER_ACTION_REQUIRED' ? [{ rel: 'payer-action', href: `https://paypal.fake/approve/${order.id}` }] : [],
      purchase_units: [
        {
          reference_id: order.referenceId,
          amount: { currency_code: order.currency, value: order.value },
          payments: { captures: order.captures.map((c) => ({ id: c.id, status: c.status, amount: { currency_code: c.currency, value: c.value } })) },
        },
      ],
    };
  }

  // PAYMENT.CAPTURE.COMPLETED as PayPal would POST it to /api/webhooks/paypal.
  captureCompletedEvent(paypalOrderId: string, over: { currency?: string; value?: string; status?: string } = {}) {
    const order = this.orders.get(paypalOrderId);
    return {
      id: `WH-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: `CAP-${paypalOrderId}`,
        status: over.status ?? 'COMPLETED',
        amount: { currency_code: over.currency ?? order?.currency ?? 'USD', value: over.value ?? order?.value ?? '0.00' },
        supplementary_data: { related_ids: { order_id: paypalOrderId } },
      },
    };
  }
}

export interface FakeStripeIntent {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  client_secret: string;
  metadata: Record<string, string>;
}

export class FakeStripe {
  intents = new Map<string, FakeStripeIntent>();
  createCalls: { params: any; options: any }[] = [];
  seq = 0;
  failCreate = false;
  private spies: jest.SpyInstance[] = [];
  private readonly byIdempotency = new Map<string, string>();

  constructor(private readonly service: any) {}

  private get client(): any {
    return this.service.client;
  }

  install(): void {
    this.spies.push(
      jest.spyOn(this.client.paymentIntents, 'create').mockImplementation((async (params: any, options: any) => {
        this.createCalls.push({ params, options });
        if (this.failCreate) throw new Error('Stripe is down');
        const key = options?.idempotencyKey as string | undefined;
        if (key && this.byIdempotency.has(key)) return { ...this.intents.get(this.byIdempotency.get(key)!)! };
        const id = `pi_test_${++this.seq}`;
        const intent: FakeStripeIntent = { id, status: 'requires_payment_method', amount: params.amount, amount_received: 0, currency: params.currency, client_secret: `${id}_secret_test`, metadata: params.metadata };
        this.intents.set(id, intent);
        if (key) this.byIdempotency.set(key, id);
        return { ...intent };
      }) as any),
      jest.spyOn(this.client.paymentIntents, 'retrieve').mockImplementation((async (id: string) => {
        const intent = this.intents.get(id);
        if (!intent) throw new Error(`No such payment_intent: ${id}`);
        return { ...intent };
      }) as any),
    );
  }

  reset(): void {
    this.intents.clear();
    this.createCalls = [];
    this.byIdempotency.clear();
    this.seq = 0;
    this.failCreate = false;
  }

  uninstall(): void {
    this.spies.forEach((s) => s.mockRestore());
  }

  setStatus(id: string, status: string): void {
    this.intents.get(id)!.status = status;
  }

  // The customer's card was charged (after 3-D Secure where required).
  succeed(id: string, over: { amount_received?: number; currency?: string } = {}): void {
    const intent = this.intents.get(id)!;
    intent.status = 'succeeded';
    intent.amount_received = over.amount_received ?? intent.amount;
    if (over.currency) intent.currency = over.currency;
  }

  eventPayload(type: string, intentId: string, over: Record<string, unknown> = {}): string {
    const intent = this.intents.get(intentId);
    return JSON.stringify({
      id: `evt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      object: 'event',
      type,
      data: { object: { id: intentId, amount: intent?.amount, amount_received: intent?.amount_received, currency: intent?.currency, metadata: intent?.metadata, ...over } },
    });
  }

  // Signed with the REAL Stripe SDK's own scheme.
  signature(payload: string, secret = STRIPE_WEBHOOK_SECRET): string {
    return this.client.webhooks.generateTestHeaderString({ payload, secret });
  }
}

export interface OrdersHarness {
  app: INestApplication;
  prisma: any;
  paypal: FakePayPal;
  stripe: FakeStripe;
  services: { tokens: any; credits: any; exchange: any; paypalService: any; stripeService: any };
  http: () => ReturnType<typeof request>;
  auth: (user: User) => { Authorization: string };
  mkUser: (role: 'customer' | 'admin') => Promise<User>;
  mkDesign: (pricePkr?: number) => Promise<{ design: Design; size: DesignSize }>;
  addToCart: (customer: User, design: Design, size: DesignSize) => Promise<void>;
  checkout: (customer: User, method: 'paypal' | 'stripe' | 'bank_transfer', opts?: { price?: number; credits?: number }) => Promise<{ res: request.Response; order: any; design: Design; size: DesignSize }>;
  grantCredits: (customer: User, amount: number) => Promise<void>;
  postPaypalWebhook: (event: unknown) => request.Test;
  postStripeWebhook: (payload: string, opts?: { secret?: string; header?: string | null }) => request.Test;
  uploadReceipt: (customer: User, orderId: string, file?: Buffer, filename?: string) => request.Test;
  bankOrderWithReceipt: (customer: User) => Promise<any>;
  orderRow: (id: string) => Promise<any>;
  notifCount: (user: User, type: string) => Promise<number>;
  filesStatus: (customer: User, orderId: string) => Promise<number>;
  errCode: (res: request.Response) => string | undefined;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createOrdersHarness(): Promise<OrdersHarness> {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbName = dbUrl.split('/').pop()?.split('?')[0] ?? '';
  // .env is loaded by the app itself; if DATABASE_URL isn't overridden on the command line the
  // dev database (czdigitizing) would be truncated — so read the same .env the app will read.
  const effective = dbName || readEnvDatabaseName();
  if (!/test|audit/i.test(effective)) {
    throw new Error(`Refusing to run: these specs TRUNCATE tables, and DATABASE_URL points at "${effective || '(from .env)'}". Point DATABASE_URL at a throwaway database whose name contains "test".`);
  }

  process.env.PAYPAL_CLIENT_ID = 'test-paypal-client';
  process.env.PAYPAL_CLIENT_SECRET = 'test-paypal-secret';
  process.env.PAYPAL_WEBHOOK_ID = 'test-paypal-webhook';
  process.env.STRIPE_SECRET_KEY = 'sk_test_orders_harness';
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_orders_harness';

  // Imported only now so the app's config sees the env above.
  const { AppModule } = await import('../../../src/app.module');
  const { TokenService } = await import('../../../src/auth/services/token.service');
  const { CreditsService } = await import('../../../src/credits/credits.service');
  const { ExchangeRateService } = await import('../../../src/orders/exchange-rate.service');
  const { PayPalService } = await import('../../../src/orders/payments/paypal.service');
  const { StripeService } = await import('../../../src/orders/payments/stripe.service');
  const { PrismaService } = await import('../../../src/prisma/prisma.service');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();

  const prisma = app.get(PrismaService) as any;
  const tokens = app.get(TokenService) as any;
  const credits = app.get(CreditsService) as any;
  const exchange = app.get(ExchangeRateService) as any;
  const paypalService = app.get(PayPalService) as any;
  const stripeService = app.get(StripeService) as any;

  const paypal = new FakePayPal();
  paypal.install();
  const stripe = new FakeStripe(stripeService);
  stripe.install();

  const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const http = () => request(app.getHttpServer());
  const auth = (u: User) => ({
    Authorization: `Bearer ${tokens.signAccessToken({ userId: u.id, email: u.email, role: u.role, deviceId: 'orders-test-device', permissions: [] })}`,
  });

  const h: OrdersHarness = {
    app,
    prisma,
    paypal,
    stripe,
    services: { tokens, credits, exchange, paypalService, stripeService },
    http,
    auth,
    mkUser: (role) => prisma.user.create({ data: { email: `${role}-${uid()}@orders-test.example.com`, role } }),
    mkDesign: async (pricePkr = 1500) => {
      const design = await prisma.design.create({ data: { name: `Orders Test Design ${uid()}`, previewImageUrl: 'https://example.com/p.png', pricePkr, isPublished: true } });
      const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
      await prisma.designFile.create({ data: { designId: design.id, fileFormat: 'DST', storagePath: '/tmp/does-not-matter', fileSizeBytes: 1024, uploadHash: `hash-${uid()}`, isPrivate: true } });
      return { design, size };
    },
    addToCart: async (customer, design, size) => {
      await http().post('/api/cart/items').set(auth(customer)).send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    },
    checkout: async (customer, method, opts = {}) => {
      const { design, size } = await h.mkDesign(opts.price ?? 1500);
      await h.addToCart(customer, design, size);
      const res = await http().post('/api/cart/checkout').set(auth(customer)).send({ paymentMethod: method, creditsToApplyPkr: opts.credits ?? 0 });
      return { res, order: res.body.data, design, size };
    },
    grantCredits: async (customer, amount) => {
      await prisma.$transaction((tx: any) => credits.grant(tx, customer.id, amount, 'orders test grant'));
    },
    postPaypalWebhook: (event) =>
      http()
        .post('/api/webhooks/paypal')
        .set({ 'paypal-transmission-id': 'tid', 'paypal-transmission-time': 'now', 'paypal-cert-url': 'https://paypal.fake/cert', 'paypal-auth-algo': 'SHA256withRSA', 'paypal-transmission-sig': 'sig' })
        .send(event as object),
    postStripeWebhook: (payload, opts = {}) => {
      const req = http().post('/api/webhooks/stripe').set('content-type', 'application/json');
      if (opts.header !== null) req.set('stripe-signature', opts.header ?? stripe.signature(payload, opts.secret));
      return req.send(payload);
    },
    uploadReceipt: (customer, orderId, file = tinyPng(), filename = 'receipt.png') => http().post(`/api/orders/${orderId}/receipt`).set(auth(customer)).attach('file', file, filename),
    bankOrderWithReceipt: async (customer) => {
      const { order } = await h.checkout(customer, 'bank_transfer');
      await h.uploadReceipt(customer, order.id).expect(201);
      return order;
    },
    orderRow: (id) => prisma.order.findUniqueOrThrow({ where: { id: BigInt(id) } }),
    notifCount: (u, type) => prisma.notification.count({ where: { recipientUserId: u.id, notificationType: type } }),
    filesStatus: async (customer, orderId) => (await http().get(`/api/orders/${orderId}/files`).set(auth(customer))).status,
    errCode: (res) => res.body?.error?.code,
    reset: async () => {
      paypal.reset();
      stripe.reset();
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "users","designs","exchange_rates","payment_method_settings" RESTART IDENTITY CASCADE');
      await exchange.onModuleInit(); // what boot does on a fresh database: seed rates so provider payments can be priced
    },
    close: async () => {
      paypal.uninstall();
      stripe.uninstall();
      await app.close();
    },
  };
  return h;
}

function readEnvDatabaseName(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const text = require('fs').readFileSync(require('path').join(__dirname, '../../../.env'), 'utf8') as string;
    const m = /^DATABASE_URL=(.*)$/m.exec(text);
    return m ? (m[1].trim().split('/').pop() ?? '').split('?')[0] : '';
  } catch {
    return '';
  }
}
