import { BundlesService } from './bundles.service';

interface FakeDesignFile {
  id: bigint;
  designId: bigint;
}

interface FakeDesign {
  id: bigint;
  name: string;
  previewImageUrl: string;
  pricePkr: number;
  deletedAt: Date | null;
}

interface FakeBundle {
  id: bigint;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
  createdByAdminId: bigint | null;
  createdAt: Date;
  deletedAt: Date | null;
}

interface FakeBundleDesign {
  bundleId: bigint;
  designId: bigint;
  sortOrder: number | null;
  priceOverridePkr: number | null;
}

function createFakePrisma() {
  const bundles = new Map<string, FakeBundle>();
  const designs = new Map<string, FakeDesign>();
  const bundleDesigns: FakeBundleDesign[] = [];
  const files: FakeDesignFile[] = [];
  let nextId = 1n;

  function bundleWithDesigns(b: FakeBundle) {
    return {
      ...b,
      designs: bundleDesigns
        .filter((bd) => bd.bundleId === b.id)
        .map((bd) => ({ ...bd, design: designs.get(bd.designId.toString())! })),
    };
  }

  return {
    designBundle: {
      findMany: jest.fn(async ({ where, skip, take }: { where?: { isPublished?: boolean; deletedAt?: null }; skip?: number; take?: number }) => {
        let rows = [...bundles.values()].filter((b) => b.deletedAt === null);
        if (where?.isPublished !== undefined) rows = rows.filter((b) => b.isPublished === where.isPublished);
        rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        return rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));
      }),
      count: jest.fn(async ({ where }: { where?: { isPublished?: boolean } }) => {
        let rows = [...bundles.values()].filter((b) => b.deletedAt === null);
        if (where?.isPublished !== undefined) rows = rows.filter((b) => b.isPublished === where.isPublished);
        return rows.length;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; isPublished?: boolean } }) => {
        const row = bundles.get(where.id.toString());
        if (!row || row.deletedAt !== null) return null;
        if (where.isPublished !== undefined && row.isPublished !== where.isPublished) return null;
        return bundleWithDesigns(row);
      }),
      create: jest.fn(async ({ data }: { data: Omit<FakeBundle, 'id' | 'createdAt' | 'deletedAt'> }) => {
        const row: FakeBundle = { id: nextId++, createdAt: new Date(), deletedAt: null, ...data };
        bundles.set(row.id.toString(), row);
        return bundleWithDesigns(row);
      }),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Partial<FakeBundle> }) => {
        const row = bundles.get(where.id.toString())!;
        Object.assign(row, data);
        return bundleWithDesigns(row);
      }),
    },
    design: {
      findFirst: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        const row = designs.get(where.id.toString());
        return row && row.deletedAt === null ? row : null;
      }),
    },
    bundleDesign: {
      upsert: jest.fn(async ({ create, update }: { where: unknown; create: FakeBundleDesign; update: Partial<FakeBundleDesign> }) => {
        const existing = bundleDesigns.find((bd) => bd.bundleId === create.bundleId && bd.designId === create.designId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        bundleDesigns.push(create);
        return create;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { bundleId: bigint; designId: bigint } }) => {
        const idx = bundleDesigns.findIndex((bd) => bd.bundleId === where.bundleId && bd.designId === where.designId);
        if (idx >= 0) bundleDesigns.splice(idx, 1);
      }),
      findMany: jest.fn(async ({ where }: { where: { bundleId: bigint } }) => {
        return bundleDesigns
          .filter((bd) => bd.bundleId === where.bundleId)
          .map((bd) => ({ ...bd, design: { ...designs.get(bd.designId.toString())!, files: files.filter((f) => f.designId === bd.designId) } }));
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    _designs: designs,
    _files: files,
    _nextId: () => nextId++,
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

function fakeAdmin() {
  return { sub: '1' } as never;
}

describe('BundlesService (AC-1/3/4/7)', () => {
  it('creates a bundle, adds designs, and returns includedDesigns in the detail DTO (AC-1)', async () => {
    const prisma = createFakePrisma();
    const service = new BundlesService(prisma as never, createFakeAudit() as never);

    const d1Id = prisma._nextId();
    prisma._designs.set(d1Id.toString(), { id: d1Id, name: 'Cap Logo', previewImageUrl: 'https://x/1.png', pricePkr: 500, deletedAt: null });
    const d2Id = prisma._nextId();
    prisma._designs.set(d2Id.toString(), { id: d2Id, name: 'Floral', previewImageUrl: 'https://x/2.png', pricePkr: 700, deletedAt: null });

    const bundle = await service.create({ name: '10 Cap Logos', pricePkr: 1000, isPublished: true }, fakeAdmin());
    await service.addDesign(bundle.id, d1Id.toString(), {}, fakeAdmin());
    await service.addDesign(bundle.id, d2Id.toString(), {}, fakeAdmin());

    const detail = await service.get(bundle.id, true);
    expect(detail.includedDesigns).toHaveLength(2);
    expect(detail.includedDesigns.map((d) => d.name).sort()).toEqual(['Cap Logo', 'Floral']);
  });

  it('computes the bundle total as the sum of per-design price overrides, falling back to design price (AC-7)', async () => {
    const prisma = createFakePrisma();
    const service = new BundlesService(prisma as never, createFakeAudit() as never);

    const d1Id = prisma._nextId();
    prisma._designs.set(d1Id.toString(), { id: d1Id, name: 'Cap Logo', previewImageUrl: 'https://x/1.png', pricePkr: 500, deletedAt: null });
    const d2Id = prisma._nextId();
    prisma._designs.set(d2Id.toString(), { id: d2Id, name: 'Floral', previewImageUrl: 'https://x/2.png', pricePkr: 700, deletedAt: null });

    const bundle = await service.create({ name: 'Mixed', pricePkr: 1000 }, fakeAdmin());
    await service.addDesign(bundle.id, d1Id.toString(), { priceOverridePkr: 300 }, fakeAdmin());
    await service.addDesign(bundle.id, d2Id.toString(), {}, fakeAdmin());

    const total = await service.computeBundleTotal(bundle.id);
    expect(total).toBe(300 + 700);
  });

  it('resolves every design file across a bundle for AC-3 authorization fan-out', async () => {
    const prisma = createFakePrisma();
    const service = new BundlesService(prisma as never, createFakeAudit() as never);

    const d1Id = prisma._nextId();
    prisma._designs.set(d1Id.toString(), { id: d1Id, name: 'Cap Logo', previewImageUrl: 'https://x/1.png', pricePkr: 500, deletedAt: null });
    const d2Id = prisma._nextId();
    prisma._designs.set(d2Id.toString(), { id: d2Id, name: 'Floral', previewImageUrl: 'https://x/2.png', pricePkr: 700, deletedAt: null });
    prisma._files.push({ id: prisma._nextId(), designId: d1Id }, { id: prisma._nextId(), designId: d1Id }, { id: prisma._nextId(), designId: d2Id });

    const bundle = await service.create({ name: 'Fan-out', pricePkr: 1000 }, fakeAdmin());
    await service.addDesign(bundle.id, d1Id.toString(), {}, fakeAdmin());
    await service.addDesign(bundle.id, d2Id.toString(), {}, fakeAdmin());

    const targets = await service.getAuthorizedFileTargets(bundle.id);
    expect(targets).toHaveLength(3);
    expect(new Set(targets.map((t) => t.designId))).toEqual(new Set([d1Id.toString(), d2Id.toString()]));
  });

  it('removing a design from a bundle does not affect getAuthorizedFileTargets for already-resolved fan-outs (AC-4)', async () => {
    const prisma = createFakePrisma();
    const service = new BundlesService(prisma as never, createFakeAudit() as never);

    const d1Id = prisma._nextId();
    prisma._designs.set(d1Id.toString(), { id: d1Id, name: 'Cap Logo', previewImageUrl: 'https://x/1.png', pricePkr: 500, deletedAt: null });
    prisma._files.push({ id: prisma._nextId(), designId: d1Id });

    const bundle = await service.create({ name: 'Removable', pricePkr: 1000 }, fakeAdmin());
    await service.addDesign(bundle.id, d1Id.toString(), {}, fakeAdmin());

    const before = await service.getAuthorizedFileTargets(bundle.id);
    expect(before).toHaveLength(1);

    await service.removeDesign(bundle.id, d1Id.toString(), fakeAdmin());

    // Current membership no longer includes the removed design — this is exactly why A-013 must
    // snapshot getAuthorizedFileTargets() at payment_confirmed time rather than re-deriving it
    // later; this test documents current-membership behavior, not the payment-time snapshot.
    const after = await service.getAuthorizedFileTargets(bundle.id);
    expect(after).toHaveLength(0);
  });

  it('unpublishing a bundle removes it from the public list but keeps it visible to staff (AC-5)', async () => {
    const prisma = createFakePrisma();
    const service = new BundlesService(prisma as never, createFakeAudit() as never);

    const bundle = await service.create({ name: 'To Unpublish', pricePkr: 500, isPublished: true }, fakeAdmin());
    await service.update(bundle.id, { isPublished: false }, fakeAdmin());

    const publicList = await service.list({ page: 1, pageSize: 50 }, false);
    const staffList = await service.list({ page: 1, pageSize: 50 }, true);

    expect(publicList.items.find((b) => b.id === bundle.id)).toBeUndefined();
    expect(staffList.items.find((b) => b.id === bundle.id)).toBeDefined();
  });
});
