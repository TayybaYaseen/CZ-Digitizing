import { CategoriesService } from './categories.service';

function createFakePrisma() {
  const categories = new Map<string, { id: bigint; name: string; slug: string; sortOrder: number; isPublished: boolean }>();
  const subcategories = new Map<
    string,
    { id: bigint; name: string; slug: string; parentCategoryId: bigint; sortOrder: number; isPublished: boolean }
  >();
  let nextId = 1n;

  return {
    designCategory: {
      findMany: jest.fn(async ({ where }: { where?: { isPublished?: boolean } } = {}) => {
        const rows = [...categories.values()];
        return where?.isPublished === undefined ? rows : rows.filter((r) => r.isPublished === where.isPublished);
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: bigint; slug?: string } }) => {
        if (where.id !== undefined) return categories.get(where.id.toString()) ?? null;
        return [...categories.values()].find((c) => c.slug === where.slug) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: { name: string; slug: string; sortOrder: number; isPublished: boolean } }) => {
        const row = { id: nextId++, ...data };
        categories.set(row.id.toString(), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = categories.get(where.id.toString())!;
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        categories.delete(where.id.toString());
      }),
    },
    designSubcategory: {
      findMany: jest.fn(async ({ where }: { where: { parentCategoryId: bigint; isPublished?: boolean } }) => {
        return [...subcategories.values()].filter(
          (r) => r.parentCategoryId === where.parentCategoryId && (where.isPublished === undefined || r.isPublished === where.isPublished),
        );
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: bigint; slug?: string } }) => {
        if (where.id !== undefined) return subcategories.get(where.id.toString()) ?? null;
        return [...subcategories.values()].find((s) => s.slug === where.slug) ?? null;
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { name: string; slug: string; parentCategoryId: bigint; sortOrder: number; isPublished: boolean };
        }) => {
          const row = { id: nextId++, ...data };
          subcategories.set(row.id.toString(), row);
          return row;
        },
      ),
    },
    _categories: categories,
    _subcategories: subcategories,
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

function fakeAdmin() {
  return { sub: '1' } as never;
}

describe('CategoriesService (AC-1)', () => {
  it('creates a published main category and lists it for public callers', async () => {
    const prisma = createFakePrisma();
    const service = new CategoriesService(prisma as never, createFakeAudit() as never);

    await service.createCategory({ name: 'Animals', slug: 'animals', isPublished: true }, fakeAdmin());
    const published = await service.listCategories(true);

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ name: 'Animals', slug: 'animals' });
  });

  it('hides an unpublished category from public (published-only) listing but not from staff', async () => {
    const prisma = createFakePrisma();
    const service = new CategoriesService(prisma as never, createFakeAudit() as never);

    await service.createCategory({ name: 'Draft Category', slug: 'draft-category', isPublished: false }, fakeAdmin());

    expect(await service.listCategories(true)).toHaveLength(0);
    expect(await service.listCategories(false)).toHaveLength(1);
  });

  it('rejects creating a category with a slug that is already in use', async () => {
    const prisma = createFakePrisma();
    const service = new CategoriesService(prisma as never, createFakeAudit() as never);

    await service.createCategory({ name: 'Animals', slug: 'animals', isPublished: true }, fakeAdmin());

    await expect(service.createCategory({ name: 'Animals Again', slug: 'animals', isPublished: true }, fakeAdmin())).rejects.toThrow();
  });

  it('creates a subcategory under a main category and lists it (AC-1 optional subcategories)', async () => {
    const prisma = createFakePrisma();
    const service = new CategoriesService(prisma as never, createFakeAudit() as never);

    const category = await service.createCategory({ name: 'Animals', slug: 'animals', isPublished: true }, fakeAdmin());
    await service.createSubcategory(category.id, { name: 'Dogs', slug: 'dogs', isPublished: true }, fakeAdmin());

    const subs = await service.listSubcategories(category.id, true);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ name: 'Dogs', slug: 'dogs', parentCategoryId: category.id });
  });

  it('throws RESOURCE_NOT_FOUND when creating a subcategory under a non-existent category', async () => {
    const prisma = createFakePrisma();
    const service = new CategoriesService(prisma as never, createFakeAudit() as never);

    await expect(service.createSubcategory('999', { name: 'Dogs', slug: 'dogs' }, fakeAdmin())).rejects.toThrow();
  });
});
