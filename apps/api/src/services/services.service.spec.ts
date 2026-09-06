import { ServicesService } from './services.service';

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1n,
    name: 'Embroidery Digitizing',
    slug: 'embroidery-digitizing',
    type: 'embroidery_digitizing',
    parentServiceId: null,
    description: 'd',
    visualImageUrl: '/img.jpg',
    applications: 'a',
    process: 'p',
    relatedDesignCategoryId: null,
    sortOrder: 0,
    isPublished: true,
    createdByAdminId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFaq(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 1n, relatedService: null, relatedCategory: null, isPublished: true, ...overrides };
}

function createFakePrisma(services: ReturnType<typeof makeService>[], faqs: ReturnType<typeof makeFaq>[] = []) {
  return {
    service: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        services
          .filter((r) => {
            if (where.parentServiceId === null && r.parentServiceId !== null) return false;
            const inClause = where.parentServiceId as { in?: bigint[] } | undefined;
            if (inClause?.in && !inClause.in.includes(r.parentServiceId as bigint)) return false;
            if (where.isPublished !== undefined && r.isPublished !== where.isPublished) return false;
            return true;
          })
          .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number)),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id?: bigint; slug?: string } }) =>
        services.find((r) => (where.id !== undefined ? r.id === where.id : r.slug === where.slug)) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = makeService({ id: BigInt(services.length + 1), ...data });
        services.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = services.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        const idx = services.findIndex((r) => r.id === where.id);
        services.splice(idx, 1);
      }),
    },
    faq: {
      findMany: jest.fn(async ({ where }: { where: { OR: Record<string, unknown>[] } }) =>
        faqs.filter((f) => where.OR.some((clause) => Object.entries(clause).every(([k, v]) => (f as Record<string, unknown>)[k] === v))),
      ),
    },
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

const admin = { sub: '99' } as never;

// docs/specs/2026-08-29-17-services-module.md §2/§6 (aspect A-014).
describe('ServicesService', () => {
  it('AC-1: lists main services with nested sub-services', async () => {
    const rows = [
      makeService({ id: 1n, slug: 'embroidery-digitizing', sortOrder: 0 }),
      makeService({ id: 2n, slug: 'vector-art', type: 'vector_art', sortOrder: 1 }),
      makeService({ id: 3n, slug: 'logo-digitizing', parentServiceId: 1n, sortOrder: 0 }),
    ];
    const service = new ServicesService(createFakePrisma(rows) as never, createFakeAudit() as never);

    const result = await service.listMainServices(true);

    expect(result.map((r) => r.slug)).toEqual(['embroidery-digitizing', 'vector-art']);
    expect(result[0].subServices.map((s) => s.slug)).toEqual(['logo-digitizing']);
    expect(result[1].subServices).toEqual([]);
  });

  it('AC-6: resolves relatedFaqIds by matching faqs.related_service/related_category to slug or name', async () => {
    const rows = [makeService({ id: 1n, slug: 'vector-art', name: 'Vector Art' })];
    const faqs = [makeFaq({ id: 10n, relatedService: 'vector-art' }), makeFaq({ id: 11n, relatedCategory: 'Vector Art' }), makeFaq({ id: 12n, relatedService: 'other' })];
    const service = new ServicesService(createFakePrisma(rows, faqs) as never, createFakeAudit() as never);

    const detail = await service.getBySlug('vector-art', true);

    expect(detail.relatedFaqIds.sort()).toEqual(['10', '11']);
  });

  it("hierarchy validation: rejects a sub-service parent whose type doesn't match", async () => {
    const rows = [makeService({ id: 1n, slug: 'vector-art', type: 'vector_art' })];
    const service = new ServicesService(createFakePrisma(rows) as never, createFakeAudit() as never);

    await expect(
      service.create(
        {
          name: 'Cap & Hat Digitizing',
          slug: 'cap-hat-digitizing',
          type: 'embroidery_digitizing',
          parentServiceId: '1',
          description: 'd',
          visualImageUrl: '/i.jpg',
          applications: 'a',
          process: 'p',
        } as never,
        admin,
      ),
    ).rejects.toThrow();
  });

  it('hierarchy validation: rejects a parent that is itself a sub-service', async () => {
    const rows = [makeService({ id: 1n, slug: 'main' }), makeService({ id: 2n, slug: 'sub', parentServiceId: 1n })];
    const service = new ServicesService(createFakePrisma(rows) as never, createFakeAudit() as never);

    await expect(
      service.create(
        {
          name: 'Nested',
          slug: 'nested',
          type: 'embroidery_digitizing',
          parentServiceId: '2',
          description: 'd',
          visualImageUrl: '/i.jpg',
          applications: 'a',
          process: 'p',
        } as never,
        admin,
      ),
    ).rejects.toThrow();
  });

  it('AC-8: reorder updates sortOrder and audit-logs the change', async () => {
    const rows = [makeService({ id: 1n, sortOrder: 0 })];
    const audit = createFakeAudit();
    const service = new ServicesService(createFakePrisma(rows) as never, audit as never);

    const result = await service.reorder('1', { sortOrder: 5 }, admin);

    expect(result.sortOrder).toBe(5);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'SERVICE_REORDERED' }));
  });
});
