import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with `prisma migrate dev`
// already applied. Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-13 — the public search endpoint (AC-6)
// must never leak Admin-only fields or unpublished/soft-deleted catalog rows, even when the query
// text happens to match an internal-only value.
describe('Design search privacy (AC-13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.favorite.deleteMany();
    await prisma.designCategoryAssignment.deleteMany();
    await prisma.designSize.deleteMany();
    await prisma.design.deleteMany();
    await prisma.user.deleteMany({ where: { role: 'admin' } });
  });

  const agent = () => request(app.getHttpServer());

  it('never returns createdByAdminId, or any admin-only field, on a public search result', async () => {
    const admin = await prisma.user.create({ data: { email: `admin-${Date.now()}@example.com`, role: 'admin' } });
    await prisma.design.create({
      data: {
        name: 'Secret Admin Rose 12345',
        previewImageUrl: 'https://example.com/preview.png',
        pricePkr: 500,
        isPublished: true,
        createdByAdminId: admin.id,
      },
    });

    const res = await agent().get('/api/designs/search').query({ q: '12345' }).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty('createdByAdminId');
    expect(JSON.stringify(res.body)).not.toContain(admin.id.toString());
  });

  it('never returns an unpublished design from search, even when its name matches the query exactly', async () => {
    await prisma.design.create({
      data: { name: 'Unpublished Draft Unicorn', previewImageUrl: 'https://example.com/preview.png', pricePkr: 500, isPublished: false },
    });

    const res = await agent().get('/api/designs/search').query({ q: 'Unpublished Draft Unicorn' }).expect(200);

    expect(res.body.data).toHaveLength(0);
  });

  it('never returns a soft-deleted design from search, even if published before deletion', async () => {
    const design = await prisma.design.create({
      data: { name: 'Deleted Peacock Motif', previewImageUrl: 'https://example.com/preview.png', pricePkr: 500, isPublished: true },
    });
    await prisma.design.update({ where: { id: design.id }, data: { deletedAt: new Date(), isPublished: false } });

    const res = await agent().get('/api/designs/search').query({ q: 'Deleted Peacock Motif' }).expect(200);

    expect(res.body.data).toHaveLength(0);
  });

  it('search suggestions never include private-file metadata fields, matching the same DTO shape as search', async () => {
    await prisma.design.create({
      data: { name: 'Suggestion Test Rose', previewImageUrl: 'https://example.com/preview.png', pricePkr: 500, isPublished: true },
    });

    const res = await agent().get('/api/designs/search/suggestions').query({ q: 'Suggestion Test Rose' }).expect(200);

    expect(res.body.data.designs).toHaveLength(1);
    expect(res.body.data.designs[0]).not.toHaveProperty('createdByAdminId');
    for (const key of Object.keys(res.body.data.designs[0])) {
      expect(key).not.toMatch(/storage|file_format|filePath|isPrivate/i);
    }
  });
});
