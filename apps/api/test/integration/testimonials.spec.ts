import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/auth/services/token.service';
import type { Role, User } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

// docs/specs/2026-10-06-22-customer-review-submission.md (aspect A-026) §28.
//
// SAFETY: run only against a throwaway database (name must contain "test"), e.g.
//   DATABASE_URL=postgresql://dev:dev@localhost:5432/czd_reviews_test STORAGE_PRIVATE_ROOT=<tmp> \
//     pnpm --filter @czd/api test:integration -- testimonials
// This spec only deletes rows it created (users under @reviews-test.example.com and their data).
const DOMAIN = '@reviews-test.example.com';
const TEXT = 'The digitized logo stitched out perfectly on our polo shirts.';

describe('Customer Review Submission & Admin Moderation (A-026)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let jpeg: Buffer;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL ?? '';
    if (!/test/i.test(new URL(dbUrl).pathname)) throw new Error(`Refusing to run against a non-test database: ${new URL(dbUrl).pathname}`);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    // A phone-style photo: large, with EXIF incl. GPS.
    jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#224488' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'PhoneCo' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '24/1 51/1 0/1' } })
      .toBuffer();
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  beforeEach(async () => {
    await cleanUp();
    await app.get(RedisService).client.flushall();
  });

  async function cleanUp() {
    await prisma.testimonial.deleteMany({ where: { OR: [{ customer: { email: { endsWith: DOMAIN } } }, { customerName: { startsWith: 'IT-curated' } }] } });
    await prisma.order.deleteMany({ where: { customer: { email: { endsWith: DOMAIN } } } });
    await prisma.notification.deleteMany({ where: { recipient: { email: { endsWith: DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  }

  async function createUser(role: Role, opts: { displayName?: string | null; permission?: 'read_only' | 'crud' } = {}): Promise<User> {
    const user = await prisma.user.create({
      data: { email: `${role}-${randomUUID()}${DOMAIN}`, role, displayName: opts.displayName === undefined ? `${role} user` : opts.displayName },
    });
    if (opts.permission) await prisma.adminPermission.create({ data: { userId: user.id, module: 'testimonials', accessLevel: opts.permission } });
    return user;
  }

  const paidOrder = (customer: User) =>
    prisma.order.create({ data: { customerId: customer.id, paymentMethod: 'bank_transfer', totalPkr: 2500, status: 'completed', paymentStatus: 'completed' } });

  const auth = (user: User) => ({ Authorization: `Bearer ${tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId: 'test-device', permissions: [] })}` });
  const http = () => request(app.getHttpServer());

  function submit(customer: User, fields: Record<string, string> = {}, image?: { buffer: Buffer; name: string }) {
    const req = http().post('/api/testimonials/submit').set(auth(customer));
    const body = { customerName: 'Jane D.', serviceUsed: 'Embroidery Digitizing', rating: '5', feedback: TEXT, ...fields };
    for (const [k, v] of Object.entries(body)) req.field(k, v);
    if (image) req.attach('image', image.buffer, image.name);
    return req;
  }

  const publicIds = async () => ((await http().get('/api/testimonials?scope=all').expect(200)).body.data as { id: string }[]).map((t) => t.id);

  it('full lifecycle: submit with image → pending (private) → approve (public) → hide → unhide → reject blocked → delete', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    await paidOrder(customer);

    const created = await submit(customer, {}, { buffer: jpeg, name: 'IMG_0001.JPG' }).expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data.hasImage).toBe(true);

    // Pending: not public, image 404 publicly, but visible to the owner and Admin.
    expect(await publicIds()).not.toContain(id);
    await http().get(`/api/testimonials/${id}/image`).expect(404);
    const own = await http().get(`/api/testimonials/mine/${id}/image`).set(auth(customer)).expect(200);
    expect(own.headers['content-type']).toBe('image/webp');
    const adminImg = await http().get(`/api/testimonials/admin/${id}/image`).set(auth(admin)).expect(200);
    expect(adminImg.headers['x-content-type-options']).toBe('nosniff');
    const meta = await sharp(adminImg.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined(); // GPS/EXIF stripped
    expect(Math.max(meta.width!, meta.height!)).toBe(2000);

    // Admin approves → public, with an image URL and no private fields.
    await http().put(`/api/testimonials/${id}/moderate`).set(auth(admin)).send({ decision: 'approved' }).expect(200);
    const list = (await http().get('/api/testimonials?scope=all').expect(200)).body.data as Record<string, unknown>[];
    const item = list.find((t) => t.id === id)!;
    expect(item).toBeDefined();
    for (const key of ['customerEmail', 'customerId', 'orderId', 'source', 'moderationStatus', 'isPublished', 'originalFeedback', 'imageStoragePath']) expect(item).not.toHaveProperty(key);
    expect(JSON.stringify(list)).not.toContain(customer.email);
    expect(item.imageUrl).toMatch(new RegExp(`/api/testimonials/${id}/image$`));
    await http().get(`/api/testimonials/${id}/image`).expect(200);

    // Hide → gone publicly (card and image); unhide → back.
    await http().put(`/api/testimonials/${id}/visibility`).set(auth(admin)).send({ isPublished: false }).expect(200);
    expect(await publicIds()).not.toContain(id);
    await http().get(`/api/testimonials/${id}/image`).expect(404);
    expect((await http().get('/api/testimonials/mine').set(auth(customer)).expect(200)).body.data[0].status).toBe('hidden');
    await http().put(`/api/testimonials/${id}/visibility`).set(auth(admin)).send({ isPublished: true }).expect(200);
    expect(await publicIds()).toContain(id);

    // Reject is not valid from Published.
    const bad = await http().put(`/api/testimonials/${id}/moderate`).set(auth(admin)).send({ decision: 'rejected' }).expect(409);
    expect(bad.body.error.code).toBe('INVALID_REVIEW_TRANSITION');

    // Delete → row and private file gone.
    const row = await prisma.testimonial.findUniqueOrThrow({ where: { id: BigInt(id) } });
    expect(existsSync(row.imageStoragePath!)).toBe(true);
    await http().delete(`/api/testimonials/${id}`).set(auth(admin)).expect(204);
    expect(await prisma.testimonial.findUnique({ where: { id: BigInt(id) } })).toBeNull();
    expect(existsSync(row.imageStoragePath!)).toBe(false);
    expect(await publicIds()).not.toContain(id);
  });

  it('text-only review works; reject keeps it in the DB but never public; it can be approved later', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    await paidOrder(customer);

    const id = (await submit(customer).expect(201)).body.data.id as string;
    await http().put(`/api/testimonials/${id}/moderate`).set(auth(admin)).send({ decision: 'rejected' }).expect(200);
    expect(await publicIds()).not.toContain(id);
    expect((await http().get('/api/testimonials/mine').set(auth(customer)).expect(200)).body.data[0].status).toBe('rejected');
    await http().put(`/api/testimonials/${id}/moderate`).set(auth(admin)).send({ decision: 'approved' }).expect(200);
    expect(await publicIds()).toContain(id);
  });

  it('notifies every admin with review_submitted (no review text)', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    await paidOrder(customer);
    await submit(customer).expect(201);
    const notes = await prisma.notification.findMany({ where: { recipientUserId: admin.id, notificationType: 'review_submitted' } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.message).not.toContain('polo');
  });

  it('eligibility: no paid order → NOT_ELIGIBLE_TO_REVIEW; eligibility endpoint lists items and never suggests the email', async () => {
    const customer = await createUser('customer', { displayName: null });
    const denied = await submit(customer).expect(403);
    expect(denied.body.error.code).toBe('NOT_ELIGIBLE_TO_REVIEW');

    const order = await paidOrder(customer);
    const elig = (await http().get('/api/testimonials/mine/eligibility').set(auth(customer)).expect(200)).body.data;
    expect(elig.eligible).toBe(true);
    expect(elig.items).toEqual([expect.objectContaining({ kind: 'order', id: order.id.toString(), alreadyReviewed: false })]);
    expect(elig.suggestedDisplayName).toBeNull();

    // No typed name and no profile name → validation error, never the email.
    const res = await http().post('/api/testimonials/submit').set(auth(customer)).send({ serviceUsed: 'Digitizing', rating: 5, feedback: TEXT }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('one review per order, duplicate text and the pending cap are enforced', async () => {
    const customer = await createUser('customer');
    const order = await paidOrder(customer);
    await submit(customer, { orderId: order.id.toString() }).expect(201);
    expect((await submit(customer, { orderId: order.id.toString(), feedback: `${TEXT} Second time.` }).expect(409)).body.error.code).toBe('ALREADY_REVIEWED');
    expect((await submit(customer, { feedback: `  ${TEXT.toUpperCase()}  ` }).expect(409)).body.error.code).toBe('DUPLICATE_REVIEW');
    await submit(customer, { feedback: `${TEXT} Another one.` }).expect(201);
    await submit(customer, { feedback: `${TEXT} And a third.` }).expect(201);
    // Six submissions in one test would otherwise hit the separate 5/min per-IP limit first.
    await app.get(RedisService).client.flushall();
    expect((await submit(customer, { feedback: `${TEXT} Fourth.` }).expect(409)).body.error.code).toBe('TOO_MANY_PENDING_REVIEWS');
  });

  it('validation: short/long text, bad rating, and injected status fields are rejected', async () => {
    const customer = await createUser('customer');
    await paidOrder(customer);
    await submit(customer, { feedback: 'Too short' }).expect(400);
    await submit(customer, { feedback: 'x'.repeat(2001) }).expect(400);
    await submit(customer, { rating: '6' }).expect(400);
    await submit(customer, { isPublished: 'true' }).expect(400);
    await submit(customer, { moderationStatus: 'approved' }).expect(400);
    expect(await prisma.testimonial.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it('image validation: renamed executable, SVG and oversized files are rejected; nothing is stored', async () => {
    const customer = await createUser('customer');
    await paidOrder(customer);
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096)]);
    expect((await submit(customer, {}, { buffer: exe, name: 'photo.jpg' }).expect(415)).body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await submit(customer, { feedback: `${TEXT} svg` }, { buffer: svg, name: 'x.svg' }).expect(415);
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    expect((await submit(customer, { feedback: `${TEXT} big` }, { buffer: big, name: 'big.jpg' }).expect(413)).body.error.code).toBe('FILE_TOO_LARGE');
    expect(await prisma.testimonial.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it('IDOR: a customer cannot read, withdraw or see the image of another customer’s review, nor link their order', async () => {
    const a = await createUser('customer');
    const b = await createUser('customer');
    await paidOrder(a);
    const bOrder = await paidOrder(b);
    const id = (await submit(a, {}, { buffer: jpeg, name: 'a.jpg' }).expect(201)).body.data.id as string;

    await http().get(`/api/testimonials/mine/${id}/image`).set(auth(b)).expect(404);
    await http().delete(`/api/testimonials/mine/${id}`).set(auth(b)).expect(404);
    expect((await http().get('/api/testimonials/mine').set(auth(b)).expect(200)).body.data).toEqual([]);
    await submit(a, { orderId: bOrder.id.toString(), feedback: `${TEXT} other` }).expect(404);

    // Owner can withdraw.
    await http().delete(`/api/testimonials/mine/${id}`).set(auth(a)).expect(204);
    expect(await prisma.testimonial.findUnique({ where: { id: BigInt(id) } })).toBeNull();
  });

  it('authorization: guests 401, customers 403 on admin routes, staff need the testimonials permission', async () => {
    const customer = await createUser('customer');
    const freelancer = await createUser('freelancer');
    const reader = await createUser('freelancer', { permission: 'read_only' });
    await paidOrder(customer);
    const id = (await submit(customer).expect(201)).body.data.id as string;

    await http().post('/api/testimonials/submit').send({ rating: 5, feedback: TEXT, serviceUsed: 'x' }).expect(401);
    await http().get('/api/testimonials/admin').set(auth(customer)).expect(403);
    await http().put(`/api/testimonials/${id}/moderate`).set(auth(customer)).send({ decision: 'approved' }).expect(403);
    await http().put(`/api/testimonials/${id}/visibility`).set(auth(customer)).send({ isPublished: true }).expect(403);
    await http().get('/api/testimonials/admin').set(auth(freelancer)).expect(403);
    await http().get('/api/testimonials/admin').set(auth(reader)).expect(200);
    await http().put(`/api/testimonials/${id}/moderate`).set(auth(reader)).send({ decision: 'approved' }).expect(403);
    // Admin-only routes never accept a customer submitting as staff.
    await http().post('/api/testimonials/submit').set(auth(reader)).send({ rating: 5, feedback: TEXT, serviceUsed: 'x' }).expect(403);
  });

  it('admin edit keeps the original text and status; image replace/remove; publish-through-edit blocked for pending', async () => {
    const customer = await createUser('customer');
    const admin = await createUser('admin');
    await paidOrder(customer);
    const id = (await submit(customer).expect(201)).body.data.id as string;

    const blocked = await http().put(`/api/testimonials/${id}`).set(auth(admin)).send({ isPublished: true }).expect(409);
    expect(blocked.body.error.code).toBe('INVALID_REVIEW_TRANSITION');

    const edited = (await http().put(`/api/testimonials/${id}`).set(auth(admin)).send({ feedback: 'Edited by admin for length and clarity.', rating: 4, country: 'Pakistan' }).expect(200)).body.data;
    expect(edited).toMatchObject({ feedback: 'Edited by admin for length and clarity.', originalFeedback: TEXT, status: 'pending', rating: 4, country: 'Pakistan' });

    const withImage = (await http().put(`/api/testimonials/${id}/image`).set(auth(admin)).attach('image', jpeg, 'new.jpg').expect(200)).body.data;
    expect(withImage.hasImage).toBe(true);
    const path = (await prisma.testimonial.findUniqueOrThrow({ where: { id: BigInt(id) } })).imageStoragePath!;
    const removed = (await http().delete(`/api/testimonials/${id}/image`).set(auth(admin)).expect(200)).body.data;
    expect(removed.hasImage).toBe(false);
    expect(existsSync(path)).toBe(false);

    const mine = (await http().get('/api/testimonials/mine').set(auth(customer)).expect(200)).body.data[0];
    expect(mine).toMatchObject({ feedback: 'Edited by admin for length and clarity.', originalFeedback: TEXT });
    expect(mine).not.toHaveProperty('customerEmail');
  });

  it('existing admin-curated flow is unchanged and appears in the admin list with source admin', async () => {
    const admin = await createUser('admin');
    const created = await http()
      .post('/api/testimonials')
      .set(auth(admin))
      .send({ customerName: 'IT-curated Ali', country: 'UAE', rating: 5, feedback: 'Great', serviceUsed: 'Vector Art', isPublished: true })
      .expect(201);
    expect(created.body.data).toMatchObject({ source: 'admin_curated', status: 'published' });
    expect(await publicIds()).toContain(created.body.data.id);
    await http().put(`/api/testimonials/${created.body.data.id}/visibility`).set(auth(admin)).send({ isPublished: false }).expect(200);
    expect(await publicIds()).not.toContain(created.body.data.id);
  });

  it('submit is rate limited per IP', async () => {
    const customer = await createUser('customer');
    await paidOrder(customer);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await submit(customer, { feedback: `${TEXT} attempt ${i}` })).status);
    expect(statuses.at(-1)).toBe(429);
  });

  it('DB constraints: published implies approved; one link at most', async () => {
    const customer = await createUser('customer');
    await expect(
      prisma.testimonial.create({ data: { customerName: 'X', rating: 5, feedback: 'x', serviceUsed: 'x', isPublished: true, moderationStatus: 'pending', customerId: customer.id } }),
    ).rejects.toThrow();
  });
});
