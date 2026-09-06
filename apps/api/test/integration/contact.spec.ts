import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with migrations applied.
// Run with: pnpm --filter @czd/api test:integration
//
// SRS §15 (Contact Us, aspect A-010). No dedicated spec file — see contact.service.ts's doc
// comment for why.
describe('Contact Us (SRS §15, aspect A-010)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  async function cleanUp() {
    await prisma.notification.deleteMany({ where: { recipient: { email: { contains: '@contact-test.example.com' } } } });
    await prisma.contactMessage.deleteMany({ where: { email: 'jane@contact-test.example.com' } });
    await prisma.user.deleteMany({ where: { email: { contains: '@contact-test.example.com' } } });
  }

  beforeEach(cleanUp);

  it('persists the submission and notifies every admin user', async () => {
    const admin = await prisma.user.create({
      data: { email: `admin-${Date.now()}@contact-test.example.com`, role: 'admin' },
    });

    await request(app.getHttpServer())
      .post('/api/contact')
      .send({ name: 'Jane', email: 'jane@contact-test.example.com', message: 'Hello, I have a question.' })
      .expect(204);

    const row = await prisma.contactMessage.findFirstOrThrow({ where: { email: 'jane@contact-test.example.com' } });
    expect(row.name).toBe('Jane');
    expect(row.message).toBe('Hello, I have a question.');

    const notif = await prisma.notification.findFirstOrThrow({ where: { recipientUserId: admin.id, notificationType: 'contact_message' } });
    expect(notif.message).toContain('Jane');
  });

  it('rejects an invalid payload with 400 and does not persist anything', async () => {
    await request(app.getHttpServer())
      .post('/api/contact')
      .send({ name: '', email: 'not-an-email', message: '' })
      .expect(400);

    const row = await prisma.contactMessage.findFirst({ where: { email: 'not-an-email' } });
    expect(row).toBeNull();
  });
});
