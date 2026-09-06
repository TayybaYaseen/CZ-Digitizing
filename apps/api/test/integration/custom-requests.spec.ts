import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with migrations applied.
// Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-12-custom-design-requests.md (aspect A-017/A-017a).
describe('Custom Design Request System (docs/specs/2026-08-28-12-custom-design-requests.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  async function cleanUp() {
    await prisma.notification.deleteMany({ where: { recipient: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.fileFormatRequest.deleteMany({ where: { customer: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.customerAuthorizedFile.deleteMany({ where: { customer: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.customRequestMessage.deleteMany({ where: { sender: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.customRequestFile.deleteMany({ where: { customRequest: { customer: { email: { contains: '@cr-test.example.com' } } } } });
    await prisma.customRequestReference.deleteMany({ where: { customRequest: { customer: { email: { contains: '@cr-test.example.com' } } } } });
    await prisma.orderItem.deleteMany({ where: { customRequest: { customer: { email: { contains: '@cr-test.example.com' } } } } });
    await prisma.designFile.deleteMany({ where: { design: { name: { contains: 'CR Test Design' } } } });
    await prisma.order.deleteMany({ where: { customer: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.customRequest.deleteMany({ where: { customer: { email: { contains: '@cr-test.example.com' } } } });
    await prisma.design.deleteMany({ where: { name: { contains: 'CR Test Design' } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@cr-test.example.com' } } });
  }

  beforeEach(cleanUp);

  async function createUser(role: 'admin' | 'customer' | 'freelancer'): Promise<User> {
    return prisma.user.create({ data: { email: `${role}-${Date.now()}-${Math.random()}@cr-test.example.com`, role } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  it('AC-1: a customer submitting a custom request creates a `new` row and notifies admins', async () => {
    const admin = await createUser('admin');
    const customer = await createUser('customer');

    const res = await request(app.getHttpServer())
      .post('/api/custom-requests')
      .set(authHeader(customer))
      .field('requestType', 'embroidery_custom')
      .field('sizeValue', '4x4in')
      .field('machineFormat', 'DST')
      .attach('image', Buffer.from('fake-logo-bytes'), 'logo.png')
      .expect(201);

    expect(res.body.data.status).toBe('new');
    expect(res.body.data.machineFormat).toBe('DST');

    const notif = await prisma.notification.findFirst({ where: { recipientUserId: admin.id, notificationType: 'custom_request_status_update' } });
    expect(notif).not.toBeNull();
  });

  it('AC-2: rejects an illegal status jump (new -> completed) and applies the full happy-path chain otherwise', async () => {
    const admin = await createUser('admin');
    const customer = await createUser('customer');
    const req = await prisma.customRequest.create({
      data: { requestNumber: `CR-TEST-${Date.now()}`, customerId: customer.id, requestType: 'embroidery_custom', machineFormat: 'DST' },
    });

    const illegal = await request(app.getHttpServer()).put(`/api/custom-requests/${req.id}`).set(authHeader(admin)).send({ status: 'completed' }).expect(409);
    expect(illegal.body.error.code).toBe('INVALID_CUSTOM_REQUEST_TRANSITION');

    const legal = await request(app.getHttpServer()).put(`/api/custom-requests/${req.id}`).set(authHeader(admin)).send({ status: 'reviewing' }).expect(200);
    expect(legal.body.data.status).toBe('reviewing');
  });

  it('AC-3: every status change timestamps updatedAt and notifies the customer', async () => {
    const admin = await createUser('admin');
    const customer = await createUser('customer');
    const req = await prisma.customRequest.create({
      data: { requestNumber: `CR-TEST-${Date.now()}`, customerId: customer.id, requestType: 'embroidery_custom', machineFormat: 'DST', status: 'reviewing' },
    });

    await request(app.getHttpServer()).put(`/api/custom-requests/${req.id}`).set(authHeader(admin)).send({ status: 'need_more_info' }).expect(200);

    const updated = await prisma.customRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(updated.status).toBe('need_more_info');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(req.createdAt.getTime());

    const notif = await prisma.notification.findFirst({ where: { recipientUserId: customer.id, notificationType: 'custom_request_status_update' } });
    expect(notif).not.toBeNull();
  });

  it('AC-4/AC-5: full submission -> quote -> approve -> production -> delivery -> download flow', async () => {
    const admin = await createUser('admin');
    const customer = await createUser('customer');
    const req = await prisma.customRequest.create({
      data: { requestNumber: `CR-TEST-${Date.now()}`, customerId: customer.id, requestType: 'embroidery_custom', machineFormat: 'DST', status: 'reviewing' },
    });

    const quoted = await request(app.getHttpServer())
      .post(`/api/custom-requests/${req.id}/quote`)
      .set(authHeader(admin))
      .send({ quotedPricePkr: '5000', adminNotes: 'Standard turnaround' })
      .expect(201);
    expect(quoted.body.data.status).toBe('quote_sent');

    const approved = await request(app.getHttpServer()).post(`/api/custom-requests/${req.id}/approve`).set(authHeader(customer)).send({ paymentMethod: 'bank_transfer' }).expect(201);
    const orderId = approved.body.data.id;
    expect(Number(approved.body.data.totalPkr)).toBe(5000);

    const afterApprove = await prisma.customRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(afterApprove.status).toBe('approved');
    expect(afterApprove.orderId?.toString()).toBe(orderId);

    // Confirm payment (bank-transfer path) — this is what advances the linked request to
    // in_production per OrdersService.releaseFilesAndNotify's custom-request hook.
    await prisma.order.update({ where: { id: BigInt(orderId) }, data: { status: 'payment_pending' } });
    await request(app.getHttpServer()).put(`/api/orders/${orderId}/status`).set(authHeader(admin)).send({ status: 'payment_confirmed' }).expect(200);

    const inProduction = await prisma.customRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(inProduction.status).toBe('in_production');
    expect(inProduction.paymentStatus).toBe('completed');

    // AC-9 side-state: move to ready before delivering.
    await request(app.getHttpServer()).put(`/api/custom-requests/${req.id}`).set(authHeader(admin)).send({ status: 'ready' }).expect(200);

    const delivered = await request(app.getHttpServer())
      .post(`/api/custom-requests/${req.id}/files`)
      .set(authHeader(admin))
      .attach('file', Buffer.from('final-design-bytes'), 'final.dst')
      .expect(201);
    expect(delivered.body.data).toHaveLength(1);
    const fileId = delivered.body.data[0].id;

    const afterDeliver = await prisma.customRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(afterDeliver.status).toBe('delivered');
    expect(afterDeliver.deliveredAt).not.toBeNull();

    const download = await request(app.getHttpServer()).post(`/api/custom-requests/${req.id}/files/${fileId}/download`).set(authHeader(customer)).expect(200);
    expect(download.body.data.downloadUrl).toBeTruthy();
  });

  it('AC-6: file-format-request create -> fulfill -> customer downloads through the standard authorized-file path', async () => {
    const admin = await createUser('admin');
    const customer = await createUser('customer');

    const design = await prisma.design.create({
      data: { name: 'CR Test Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 100, isPublished: true },
    });
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        status: 'payment_confirmed',
        paymentStatus: 'completed',
        paymentMethod: 'bank_transfer',
        totalPkr: 100,
        items: { create: [{ designId: design.id, quantity: 1, unitPricePkr: 100 }] },
      },
    });

    const created = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/file-format-request`)
      .set(authHeader(customer))
      .send({ requestedFormat: 'PES', notes: 'Need PES for my machine' })
      .expect(201);
    expect(created.body.data.status).toBe('pending');
    const requestId = created.body.data.id;

    const fulfilled = await request(app.getHttpServer())
      .post(`/api/file-format-requests/${requestId}/fulfill`)
      .set(authHeader(admin))
      .attach('file', Buffer.from('pes-bytes'), 'design.pes')
      .expect(201);
    expect(fulfilled.body.data.status).toBe('fulfilled');
    expect(fulfilled.body.data.fulfilledFileId).toBeTruthy();

    const authorizedFile = await prisma.customerAuthorizedFile.findFirst({ where: { orderId: order.id, customerId: customer.id, designFileId: BigInt(fulfilled.body.data.fulfilledFileId) } });
    expect(authorizedFile).not.toBeNull();

    // AC-6 — the customer downloads via the exact same authorized-download route as any other
    // purchased file, not a new one this module introduces.
    const download = await request(app.getHttpServer()).post(`/api/orders/${order.id}/files/${authorizedFile!.id}/download`).set(authHeader(customer)).expect(200);
    expect(download.body.data.downloadUrl).toBeTruthy();
  });
});
