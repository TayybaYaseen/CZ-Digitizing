import { FaqService } from './faq.service';

function makeFaq(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1n,
    question: 'q',
    answer: 'a',
    topic: 'pricing',
    relatedPage: null,
    relatedService: null,
    relatedCategory: null,
    languageCode: 'en',
    priority: 0,
    taeboVisible: false,
    isPublished: true,
    helpfulYesCount: 0,
    helpfulNoCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createFakePrisma(rows: ReturnType<typeof makeFaq>[]) {
  return {
    faq: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => {
          if (where.isPublished !== undefined && r.isPublished !== where.isPublished) return false;
          if (where.topic !== undefined && r.topic !== where.topic) return false;
          if (where.languageCode !== undefined && r.languageCode !== where.languageCode) return false;
          if (where.taeboVisible !== undefined && r.taeboVisible !== where.taeboVisible) return false;
          return true;
        }),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: bigint } }) => rows.find((r) => r.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        if ((data.helpfulYesCount as { increment: number } | undefined)?.increment) row.helpfulYesCount += 1;
        if ((data.helpfulNoCount as { increment: number } | undefined)?.increment) row.helpfulNoCount += 1;
        return row;
      }),
    },
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-1/AC-2/AC-8.
describe('FaqService', () => {
  it('filters by topic and language_code (AC-2)', async () => {
    const rows = [
      makeFaq({ id: 1n, topic: 'pricing', languageCode: 'en' }),
      makeFaq({ id: 2n, topic: 'formats', languageCode: 'en' }),
      makeFaq({ id: 3n, topic: 'pricing', languageCode: 'ur' }),
    ];
    const service = new FaqService(createFakePrisma(rows) as never, createFakeAudit() as never);

    const result = await service.list({ topic: 'pricing', language_code: 'en' });

    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  it('only surfaces taebo_visible && isPublished entries for Taebo (AC-1)', async () => {
    const rows = [
      makeFaq({ id: 1n, taeboVisible: true, isPublished: true }),
      makeFaq({ id: 2n, taeboVisible: false, isPublished: true }),
      makeFaq({ id: 3n, taeboVisible: true, isPublished: false }),
    ];
    const service = new FaqService(createFakePrisma(rows) as never, createFakeAudit() as never);

    const result = await service.listTaeboVisible();

    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  it('AC-8: feedback increments the matching helpful counter', async () => {
    const rows = [makeFaq({ id: 1n })];
    const service = new FaqService(createFakePrisma(rows) as never, createFakeAudit() as never);

    await service.feedback('1', 'yes');
    await service.feedback('1', 'no');
    await service.feedback('1', 'no');

    expect(rows[0].helpfulYesCount).toBe(1);
    expect(rows[0].helpfulNoCount).toBe(2);
  });
});
