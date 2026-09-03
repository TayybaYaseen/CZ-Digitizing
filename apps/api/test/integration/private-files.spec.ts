import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ZipService } from '../../src/files/zip.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with `prisma migrate dev`
// already applied. Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-05-private-file-management.md — full upload -> admin list -> ZIP-exclusion
// -> stub download-gate rejection flow (AC-1, AC-3, AC-4/5 stub, AC-13).
describe('Private file management (docs/specs/2026-08-28-05-private-file-management.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let zip: ZipService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    zip = app.get(ZipService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.customerAuthorizedFile.deleteMany();
    await prisma.designFile.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { role: 'admin' } });
  });

  async function createAdmin(): Promise<User> {
    return prisma.user.create({ data: { email: `admin-${Date.now()}-${Math.random()}@example.com`, role: 'admin' } });
  }

  function authHeader(user: User): { Authorization: string } {
    const token = tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] });
    return { Authorization: `Bearer ${token}` };
  }

  const agent = () => request(app.getHttpServer());

  it('AC-1/AC-13: admin uploads DST and EMB files; EMB is stored is_private=true and the format registry lists EMB as locked+private', async () => {
    const admin = await createAdmin();
    const design = await prisma.design.create({ data: { name: 'Upload Flow Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 100 } });

    const res = await agent()
      .post(`/api/designs/${design.id}/files`)
      .set(authHeader(admin))
      .attach('files', Buffer.from('LA:Rose'), 'Rose.dst')
      .attach('files', Buffer.alloc(50), 'Rose.emb')
      .expect(201);

    const files = res.body.data as { fileFormat: string; isPrivate: boolean }[];
    const dst = files.find((f) => f.fileFormat === 'DST')!;
    const emb = files.find((f) => f.fileFormat === 'EMB')!;
    expect(dst.isPrivate).toBe(false);
    expect(emb.isPrivate).toBe(true);

    const formatsRes = await agent().get('/api/admin/settings/file-formats').set(authHeader(admin)).expect(200);
    const embFormat = (formatsRes.body.data as { extension: string; isLocked: boolean; isPrivate: boolean }[]).find((f) => f.extension === 'EMB')!;
    expect(embFormat.isLocked).toBe(true);
    expect(embFormat.isPrivate).toBe(true);
  });

  it('AC-13: admin cannot upload a file whose extension is not in the active format registry', async () => {
    const admin = await createAdmin();
    const design = await prisma.design.create({ data: { name: 'Bad Format Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 100 } });

    const res = await agent().post(`/api/designs/${design.id}/files`).set(authHeader(admin)).attach('files', Buffer.alloc(10), 'Rose.xyz').expect(415);

    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('AC-3: ZipService excludes the .EMB file from a delivery ZIP built from real uploaded rows', async () => {
    const admin = await createAdmin();
    const design = await prisma.design.create({ data: { name: 'Zip Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 100 } });

    await agent()
      .post(`/api/designs/${design.id}/files`)
      .set(authHeader(admin))
      .attach('files', Buffer.from('LA:Rose'), 'Rose.dst')
      .attach('files', Buffer.alloc(50), 'Rose.emb')
      .expect(201);

    const rows = await prisma.designFile.findMany({ where: { designId: design.id } });
    const names = zip.includedNames(rows.map((r) => ({ fileFormat: r.fileFormat, storagePath: r.storagePath, originalName: `Rose.${r.fileFormat.toLowerCase()}` })));

    expect(names).toEqual(['Rose.dst']);
  });

  it('AC-5/AC-9: the customer download endpoint never streams a file — it always 422s until Orders exists, never a silent bypass', async () => {
    // No customer role token machinery duplicated here beyond what's needed to hit the route with
    // a customer-role token — reuse the same admin-creation helper's shape for a customer user.
    const customer = await prisma.user.create({ data: { email: `customer-${Date.now()}@example.com`, role: 'customer' } });

    const res = await agent().get('/api/orders/1/files').set(authHeader(customer)).expect(422);

    expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIRMED');
  });
});
