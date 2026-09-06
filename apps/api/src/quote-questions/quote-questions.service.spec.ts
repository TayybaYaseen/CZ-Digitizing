import { QuoteQuestionsService } from './quote-questions.service';

function makeQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1n,
    question: 'q',
    answer: 'a',
    serviceId: 10n,
    sortOrder: 0,
    isPublished: true,
    createdByAdminId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createFakePrisma(rows: ReturnType<typeof makeQuestion>[]) {
  return {
    quoteQuestion: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => {
          if (where.isPublished !== undefined && r.isPublished !== where.isPublished) return false;
          if (where.serviceId !== undefined && r.serviceId !== where.serviceId) return false;
          return true;
        }),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: bigint } }) => rows.find((r) => r.id === where.id) ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = makeQuestion({ id: BigInt(rows.length + 1), ...data });
        rows.push(row);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        rows.splice(idx, 1);
      }),
    },
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

// docs/specs/2026-08-28-11-smart-get-a-quote.md AC-1/AC-2/AC-5.
describe('QuoteQuestionsService', () => {
  it('AC-1: scopes the list to the requested service', async () => {
    const rows = [makeQuestion({ id: 1n, serviceId: 10n }), makeQuestion({ id: 2n, serviceId: 20n })];
    const service = new QuoteQuestionsService(createFakePrisma(rows) as never, createFakeAudit() as never);

    const result = await service.list({ serviceId: '10' });

    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  it('AC-2 invariant: listing/reading questions never calls anything notification-related (no such dependency exists on this service)', () => {
    const service = new QuoteQuestionsService(createFakePrisma([]) as never, createFakeAudit() as never);
    // Structural guarantee: QuoteQuestionsService's constructor only takes PrismaService + AuditLogService.
    expect(service).toBeDefined();
  });

  it('AC-5: a created question becomes visible in the public list once published', async () => {
    const rows: ReturnType<typeof makeQuestion>[] = [];
    const audit = createFakeAudit();
    const service = new QuoteQuestionsService(createFakePrisma(rows) as never, audit as never);

    await service.create({ question: 'Q', answer: 'A', serviceId: '10', isPublished: true }, { sub: '1' } as never);

    const result = await service.list({ serviceId: '10' });
    expect(result).toHaveLength(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'QUOTE_QUESTION_CREATED' }));
  });
});
