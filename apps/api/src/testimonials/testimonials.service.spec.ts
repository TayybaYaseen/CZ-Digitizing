import { ApiException } from '../common/exceptions/api-exception';
import { TestimonialsService } from './testimonials.service';

type Row = Record<string, unknown>;

const PAID_ORDER = { id: 1n, customerId: 42n, status: 'completed', paymentStatus: 'completed', refundedAmountPkr: null, items: [], testimonials: [] };
const ADMIN = { sub: '7' } as never;

function baseRow(over: Row = {}): Row {
  return {
    id: 5n,
    customerName: 'Jane',
    country: null,
    business: null,
    photoUrl: null,
    rating: 5,
    feedback: 'Great digitizing, stitched out perfectly.',
    originalFeedback: 'Great digitizing, stitched out perfectly.',
    serviceUsed: 'Embroidery Digitizing',
    isPublished: false,
    source: 'customer_submitted',
    moderationStatus: 'pending',
    customerId: 42n,
    orderId: null,
    customRequestId: null,
    imageStoragePath: null,
    imageContentType: null,
    imageOriginalFilename: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function setup(opts: { orders?: Row[]; requests?: Row[]; pending?: number; recent?: Row[]; existing?: Row | null; user?: Row; linkedCount?: number } = {}) {
  const orders = opts.orders ?? [PAID_ORDER];
  const prisma = {
    order: {
      findMany: jest.fn(async () => orders),
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; customerId: bigint } }) => orders.find((o) => o.id === where.id && o.customerId === where.customerId) ?? null),
    },
    customRequest: {
      findMany: jest.fn(async () => opts.requests ?? []),
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; customerId: bigint } }) => (opts.requests ?? []).find((r) => r.id === where.id && r.customerId === where.customerId) ?? null),
    },
    user: {
      findUniqueOrThrow: jest.fn(async () => opts.user ?? { displayName: null, username: null, email: 'jane@example.com' }),
      findMany: jest.fn(async () => [{ id: 1n }, { id: 2n }]),
    },
    testimonial: {
      count: jest.fn(async ({ where }: { where: Row }) => ('moderationStatus' in where ? (opts.pending ?? 0) : (opts.linkedCount ?? 0))),
      findMany: jest.fn(async () => opts.recent ?? []),
      findUnique: jest.fn(async () => (opts.existing === undefined ? baseRow() : opts.existing)),
      findFirst: jest.fn(async () => (opts.existing === undefined ? baseRow() : opts.existing)),
      create: jest.fn(async ({ data }: { data: Row }) => baseRow({ ...data, id: 9n })),
      update: jest.fn(async ({ data }: { data: Row }) => baseRow({ ...(opts.existing ?? {}), ...data })),
      delete: jest.fn(async () => undefined),
    },
  };
  const notifications = { notify: jest.fn(async () => undefined) };
  const images = { process: jest.fn(async () => ({ imageStoragePath: '/p/x.webp', imageContentType: 'image/webp', imageOriginalFilename: 'x.jpg' })), deleteIfUnreferenced: jest.fn(async () => undefined), read: jest.fn() };
  const audit = { record: jest.fn(async () => undefined) };
  const config = { get: () => 'http://api.test' };
  const service = new TestimonialsService(prisma as never, audit as never, notifications as never, images as never, config as never);
  return { service, prisma, notifications, images, audit };
}

const SUBMIT = { rating: 5, feedback: 'Great digitizing, stitched out perfectly.', serviceUsed: 'Embroidery Digitizing', customerName: 'Jane D.' };

// docs/specs/2026-10-06-22-customer-review-submission.md (A-026) §6/§18 — customer submission.
describe('TestimonialsService.submit', () => {
  it('rejects a customer with no paid order or delivered custom request (NOT_ELIGIBLE_TO_REVIEW)', async () => {
    const { service } = setup({ orders: [] });
    await expect(service.submit(SUBMIT, 42n)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE_TO_REVIEW' });
  });

  it('treats an unpaid or refunded order as not eligible', async () => {
    const { service } = setup({ orders: [{ ...PAID_ORDER, paymentStatus: 'pending' }, { ...PAID_ORDER, id: 2n, refundedAmountPkr: 100 }] });
    await expect(service.submit(SUBMIT, 42n)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE_TO_REVIEW' });
  });

  it('accepts a delivered custom request as eligibility', async () => {
    const { service } = setup({ orders: [], requests: [{ id: 3n, customerId: 42n, status: 'delivered', requestNumber: 'CR-3', requestType: 'embroidery_custom', testimonials: [] }] });
    const result = await service.submit(SUBMIT, 42n);
    expect(result.status).toBe('pending');
  });

  it("returns 404 for another customer's order rather than leaking its existence", async () => {
    const { service } = setup();
    await expect(service.submit({ ...SUBMIT, orderId: '99' }, 42n)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('rejects linking a second review to the same order (ALREADY_REVIEWED)', async () => {
    const { service } = setup({ linkedCount: 1 });
    await expect(service.submit({ ...SUBMIT, orderId: '1' }, 42n)).rejects.toMatchObject({ code: 'ALREADY_REVIEWED' });
  });

  it('caps pending reviews per customer (TOO_MANY_PENDING_REVIEWS)', async () => {
    const { service } = setup({ pending: 3 });
    await expect(service.submit(SUBMIT, 42n)).rejects.toMatchObject({ code: 'TOO_MANY_PENDING_REVIEWS' });
  });

  it('rejects the same text resubmitted within 24h, ignoring case and spacing (DUPLICATE_REVIEW)', async () => {
    const { service } = setup({ recent: [{ originalFeedback: 'great   DIGITIZING, stitched out perfectly.', feedback: 'edited' }] });
    await expect(service.submit(SUBMIT, 42n)).rejects.toMatchObject({ code: 'DUPLICATE_REVIEW' });
  });

  it('creates a pending, unpublished, customer_submitted review with the original text kept', async () => {
    const { service, prisma } = setup();
    const result = await service.submit({ ...SUBMIT, orderId: '1' }, 42n);
    const data = (prisma.testimonial.create.mock.calls[0] as unknown as [{ data: Row }])[0].data;
    expect(data).toMatchObject({ isPublished: false, moderationStatus: 'pending', source: 'customer_submitted', originalFeedback: SUBMIT.feedback, orderId: 1n });
    expect(result.status).toBe('pending');
  });

  it('never falls back to the email address for the public display name (defect D-a)', async () => {
    const { service } = setup({ user: { displayName: null, username: null, email: 'jane@example.com' } });
    await expect(service.submit({ ...SUBMIT, customerName: undefined }, 42n)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('uses the profile display name when none is typed', async () => {
    const { service, prisma } = setup({ user: { displayName: 'Jane Profile', username: null, email: 'jane@example.com' } });
    await service.submit({ ...SUBMIT, customerName: undefined }, 42n);
    expect((prisma.testimonial.create.mock.calls[0] as unknown as [{ data: Row }])[0].data.customerName).toBe('Jane Profile');
  });

  it('processes an attached image and notifies every admin without the review text', async () => {
    const { service, images, notifications, prisma } = setup();
    await service.submit(SUBMIT, 42n, { buffer: Buffer.from('x'), originalname: 'x.jpg' });
    expect(images.process).toHaveBeenCalledTimes(1);
    expect((prisma.testimonial.create.mock.calls[0] as unknown as [{ data: Row }])[0].data.imageStoragePath).toBe('/p/x.webp');
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    const call = (notifications.notify.mock.calls[0] as unknown as [{ type: string; message: string }])[0];
    expect(call.type).toBe('review_submitted');
    expect(call.message).not.toContain('stitched');
  });

  it('still succeeds when the admin notification fails', async () => {
    const { service, notifications } = setup();
    notifications.notify.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.submit(SUBMIT, 42n)).resolves.toMatchObject({ status: 'pending' });
  });
});

// §10 — status transitions.
describe('TestimonialsService moderation transitions', () => {
  it('approves a pending review into Published', async () => {
    const { service, prisma } = setup({ existing: baseRow() });
    await service.moderate('5', 'approved', ADMIN);
    expect((prisma.testimonial.update.mock.calls[0] as unknown as [{ data: Row }])[0].data).toEqual({ moderationStatus: 'approved', isPublished: true });
  });

  it('can approve a previously rejected review', async () => {
    const { service } = setup({ existing: baseRow({ moderationStatus: 'rejected' }) });
    await expect(service.moderate('5', 'approved', ADMIN)).resolves.toMatchObject({ status: 'published' });
  });

  it('refuses to reject a published review (INVALID_REVIEW_TRANSITION)', async () => {
    const { service } = setup({ existing: baseRow({ moderationStatus: 'approved', isPublished: true }) });
    await expect(service.moderate('5', 'rejected', ADMIN)).rejects.toMatchObject({ code: 'INVALID_REVIEW_TRANSITION' });
  });

  it('hides a published review and unhides a hidden one', async () => {
    const published = setup({ existing: baseRow({ moderationStatus: 'approved', isPublished: true }) });
    await expect(published.service.setVisibility('5', false, ADMIN)).resolves.toMatchObject({ status: 'hidden' });
    expect(published.audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'TESTIMONIAL_HIDDEN' }));

    const hidden = setup({ existing: baseRow({ moderationStatus: 'approved', isPublished: false }) });
    await expect(hidden.service.setVisibility('5', true, ADMIN)).resolves.toMatchObject({ status: 'published' });
  });

  it('refuses to unhide (publish) a pending review', async () => {
    const { service } = setup({ existing: baseRow() });
    await expect(service.setVisibility('5', true, ADMIN)).rejects.toMatchObject({ code: 'INVALID_REVIEW_TRANSITION' });
  });

  it('refuses isPublished=true through edit on an unapproved review (defect D-f)', async () => {
    const { service } = setup({ existing: baseRow() });
    await expect(service.update('5', { isPublished: true }, ADMIN)).rejects.toMatchObject({ code: 'INVALID_REVIEW_TRANSITION' });
  });

  it('a non-numeric id is a 404, not a BigInt crash', async () => {
    const { service } = setup();
    await expect(service.moderate('abc', 'approved', ADMIN)).rejects.toBeInstanceOf(ApiException);
  });
});

// §12/§21 — deletion and the image file.
describe('TestimonialsService deletion', () => {
  it('admin delete removes the row and then cleans up its image if unreferenced', async () => {
    const { service, prisma, images } = setup({ existing: baseRow({ imageStoragePath: '/p/a.webp', imageContentType: 'image/webp' }) });
    await service.remove('5', ADMIN);
    expect(prisma.testimonial.delete).toHaveBeenCalled();
    expect(images.deleteIfUnreferenced).toHaveBeenCalledWith('/p/a.webp');
  });

  it("a customer cannot withdraw someone else's review (404)", async () => {
    const { service, prisma } = setup({ existing: null });
    await expect(service.withdraw('5', 43n)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(prisma.testimonial.delete).not.toHaveBeenCalled();
  });
});

// §14 — the public DTO never carries private or internal fields.
describe('TestimonialsService.list (public)', () => {
  it('returns only public fields and an image URL for reviews with a photo', async () => {
    const { service, prisma } = setup();
    prisma.testimonial.findMany.mockResolvedValueOnce([baseRow({ isPublished: true, moderationStatus: 'approved', imageStoragePath: '/p/a.webp', imageContentType: 'image/webp', orderId: 1n })]);
    const [item] = await service.list('all');
    expect(Object.keys(item!).sort()).toEqual(['business', 'country', 'createdAt', 'customerName', 'feedback', 'id', 'imageUrl', 'photoUrl', 'rating', 'serviceUsed'].sort());
    expect(item!.imageUrl).toBe('http://api.test/api/testimonials/5/image');
  });
});
