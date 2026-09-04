import { ApiException } from '../common/exceptions/api-exception';
import { TestimonialsService } from './testimonials.service';

function createFakePrisma(order: Record<string, unknown> | null) {
  return {
    order: { findFirst: jest.fn(async () => order) },
    user: { findUniqueOrThrow: jest.fn(async () => ({ id: 42n, displayName: 'Jane', username: null, email: 'jane@example.com' })) },
    testimonial: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1n, createdAt: new Date(), ...data })) },
  };
}

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-7 — customer review requires a real
// completed order owned by the caller.
describe('TestimonialsService.submit', () => {
  it('rejects when the order does not belong to the caller (not found rather than leaking existence)', async () => {
    const prisma = createFakePrisma(null);
    const service = new TestimonialsService(prisma as never, { record: jest.fn() } as never);

    await expect(service.submit({ orderId: '1', rating: 5, feedback: 'great', serviceUsed: 'digitizing' }, 42n)).rejects.toThrow(ApiException);
  });

  it('rejects when the order exists but is not completed', async () => {
    const prisma = createFakePrisma({ id: 1n, customerId: 42n, status: 'processing' });
    const service = new TestimonialsService(prisma as never, { record: jest.fn() } as never);

    await expect(service.submit({ orderId: '1', rating: 5, feedback: 'great', serviceUsed: 'digitizing' }, 42n)).rejects.toMatchObject({
      code: 'ORDER_NOT_ELIGIBLE_FOR_REVIEW',
    });
  });

  it('creates a pending, unpublished, customer_submitted testimonial for a completed order', async () => {
    const prisma = createFakePrisma({ id: 1n, customerId: 42n, status: 'completed' });
    const service = new TestimonialsService(prisma as never, { record: jest.fn() } as never);

    const result = await service.submit({ orderId: '1', rating: 5, feedback: 'great', serviceUsed: 'digitizing' }, 42n);

    expect(result.isPublished).toBe(false);
    expect(result.moderationStatus).toBe('pending');
    expect(result.source).toBe('customer_submitted');
  });
});
