/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { CreditPackage, Design, DesignSize, SubscriptionPlan, User } from '../../../src/generated/prisma';

// Shared harness for the A-013 (Orders & Payment Processing) integration/e2e specs.
//
// Payment is BANK TRANSFER ONLY, so there is nothing to fake at a network boundary: every flow here
// is customer checkout -> exact PKR amount -> bank details from Admin Settings -> receipt upload ->
// Admin approve/reject, all against the real app and a real database.
//
// SAFETY: these specs TRUNCATE users/designs/exchange_rates/payment_method_settings (cascading to
// orders, carts, receipts, ...). createOrdersHarness() therefore refuses to start unless
// DATABASE_URL names a throwaway database (its name must contain "test" or "audit"). Create one
// and run migrations first, e.g.
//   createdb czd_a013_test && DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_a013_test \
//     pnpm --filter @czd/api exec prisma migrate deploy
//   DATABASE_URL=... pnpm --filter @czd/api test:integration -- orders

export const tinyPng = (): Buffer =>
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const tinyPdf = (): Buffer => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

export interface OrdersHarness {
  app: INestApplication;
  prisma: any;
  services: { tokens: any; credits: any; exchange: any; orders: any; cart: any; subscriptions: any; purchases: any };
  http: () => ReturnType<typeof request>;
  auth: (user: User) => { Authorization: string };
  mkUser: (role: 'customer' | 'admin' | 'freelancer') => Promise<User>;
  mkDesign: (pricePkr?: number) => Promise<{ design: Design; size: DesignSize }>;
  mkPackage: (over?: Partial<{ name: string; credits: number; bonusCredits: number; pricePkr: number; isPublished: boolean }>) => Promise<CreditPackage>;
  mkPlan: (over?: Partial<{ name: string; pricePkr: number; monthlyCredits: number; billingPeriod: 'monthly' | 'yearly'; isPublished: boolean }>) => Promise<SubscriptionPlan>;
  addToCart: (customer: User, design: Design, size: DesignSize) => Promise<void>;
  checkout: (customer: User, opts?: { price?: number; credits?: number }) => Promise<{ res: request.Response; order: any; design: Design; size: DesignSize }>;
  grantCredits: (customer: User, amount: number) => Promise<void>;
  setBankDetails: (config: Record<string, unknown>, isEnabled?: boolean) => Promise<void>;
  uploadReceipt: (customer: User, orderId: string, file?: Buffer, filename?: string) => request.Test;
  bankOrderWithReceipt: (customer: User) => Promise<any>;
  approve: (admin: User, orderId: string) => request.Test;
  // Admin confirms `amountPkr` as received for the latest receipt (less than outstanding = a PARTIAL payment).
  approveAmount: (admin: User, orderId: string, amountPkr: number) => request.Test;
  reject: (admin: User, orderId: string, reason?: string) => request.Test;
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

  // Imported only now so the app's config sees the env above.
  const { AppModule } = await import('../../../src/app.module');
  const { TokenService } = await import('../../../src/auth/services/token.service');
  const { CreditsService } = await import('../../../src/credits/credits.service');
  const { ExchangeRateService } = await import('../../../src/orders/exchange-rate.service');
  const { PrismaService } = await import('../../../src/prisma/prisma.service');
  const { OrdersService } = await import('../../../src/orders/orders.service');
  const { CartService } = await import('../../../src/cart/cart.service');
  const { SubscriptionsService } = await import('../../../src/subscriptions/subscriptions.service');
  const { PurchasesService } = await import('../../../src/purchases/purchases.service');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();

  const prisma = app.get(PrismaService) as any;
  const tokens = app.get(TokenService) as any;
  const credits = app.get(CreditsService) as any;
  const exchange = app.get(ExchangeRateService) as any;

  const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const http = () => request(app.getHttpServer());
  const auth = (u: User) => ({
    Authorization: `Bearer ${tokens.signAccessToken({ userId: u.id, email: u.email, role: u.role, deviceId: 'orders-test-device', permissions: [] })}`,
  });

  const h: OrdersHarness = {
    app,
    prisma,
    services: { tokens, credits, exchange, orders: app.get(OrdersService), cart: app.get(CartService), subscriptions: app.get(SubscriptionsService), purchases: app.get(PurchasesService) },
    http,
    auth,
    mkUser: (role) => prisma.user.create({ data: { email: `${role}-${uid()}@orders-test.example.com`, role } }),
    mkDesign: async (pricePkr = 1500) => {
      const design = await prisma.design.create({ data: { name: `Orders Test Design ${uid()}`, previewImageUrl: 'https://example.com/p.png', pricePkr, isPublished: true } });
      const size = await prisma.designSize.create({ data: { designId: design.id, sizeLabel: 'Standard', sizeWidthMm: 100, sizeHeightMm: 100 } });
      await prisma.designFile.create({ data: { designId: design.id, fileFormat: 'DST', storagePath: '/tmp/does-not-matter', fileSizeBytes: 1024, uploadHash: `hash-${uid()}`, isPrivate: true } });
      return { design, size };
    },
    mkPackage: (over = {}) => prisma.creditPackage.create({ data: { name: 'Starter', credits: 25, bonusCredits: 5, pricePkr: 500, isPublished: true, ...over } }),
    mkPlan: (over = {}) => prisma.subscriptionPlan.create({ data: { name: 'Pro', billingPeriod: 'monthly', pricePkr: 2000, monthlyCredits: 100, perks: ['perk'], isPublished: true, ...over } }),
    addToCart: async (customer, design, size) => {
      await http().post('/api/cart/items').set(auth(customer)).send({ designId: design.id.toString(), sizeId: size.id.toString(), quantity: 1 }).expect(201);
    },
    checkout: async (customer, opts = {}) => {
      const { design, size } = await h.mkDesign(opts.price ?? 1500);
      await h.addToCart(customer, design, size);
      const res = await http().post('/api/cart/checkout').set(auth(customer)).send({ paymentMethod: 'bank_transfer', creditsToApplyPkr: opts.credits ?? 0 });
      return { res, order: res.body.data, design, size };
    },
    grantCredits: async (customer, amount) => {
      await prisma.$transaction((tx: any) => credits.grant(tx, customer.id, amount, 'orders test grant'));
    },
    setBankDetails: async (config, isEnabled = true) => {
      await prisma.paymentMethodSetting.upsert({ where: { method: 'bank_transfer' }, create: { method: 'bank_transfer', isEnabled, config }, update: { isEnabled, config } });
    },
    uploadReceipt: (customer, orderId, file = tinyPng(), filename = 'receipt.png') => http().post(`/api/orders/${orderId}/receipt`).set(auth(customer)).attach('file', file, filename),
    bankOrderWithReceipt: async (customer) => {
      const { order } = await h.checkout(customer);
      await h.uploadReceipt(customer, order.id).expect(201);
      return order;
    },
    approve: (admin, orderId) => http().post(`/api/orders/${orderId}/payment-confirmation`).set(auth(admin)).send({ approve: true }),
    approveAmount: (admin, orderId, amountPkr) => http().post(`/api/orders/${orderId}/payment-confirmation`).set(auth(admin)).send({ approve: true, amountPkr }),
    reject: (admin, orderId, reason) => http().post(`/api/orders/${orderId}/payment-confirmation`).set(auth(admin)).send({ approve: false, ...(reason ? { rejectionReason: reason } : {}) }),
    orderRow: (id) => prisma.order.findUniqueOrThrow({ where: { id: BigInt(id) } }),
    notifCount: (u, type) => prisma.notification.count({ where: { recipientUserId: u.id, notificationType: type } }),
    filesStatus: async (customer, orderId) => (await http().get(`/api/orders/${orderId}/files`).set(auth(customer))).status,
    errCode: (res) => res.body?.error?.code,
    reset: async () => {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "users","designs","exchange_rates","payment_method_settings","credit_packages","subscription_plans" RESTART IDENTITY CASCADE');
      await exchange.onModuleInit(); // what boot does on a fresh database (display-only rates)
    },
    close: async () => {
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
