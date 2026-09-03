import { DesignsService } from './designs.service';

function createFakePrisma() {
  const favorites: { customerId: bigint; designId: bigint }[] = [];
  return {
    favorite: {
      upsert: jest.fn(async ({ create }: { create: { customerId: bigint; designId: bigint } }) => {
        if (!favorites.some((f) => f.customerId === create.customerId && f.designId === create.designId)) {
          favorites.push(create);
        }
        return create;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { customerId: bigint; designId: bigint } }) => {
        const before = favorites.length;
        const remaining = favorites.filter((f) => !(f.customerId === where.customerId && f.designId === where.designId));
        favorites.length = 0;
        favorites.push(...remaining);
        return { count: before - favorites.length };
      }),
    },
    _favorites: favorites,
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

describe('DesignsService.favorite/unfavorite (AC-8)', () => {
  it('favoriting an already-favorited design is a no-op, not a duplicate row or error', async () => {
    const prisma = createFakePrisma();
    const service = new DesignsService(prisma as never, createFakeAudit() as never);

    await service.favorite('1', 42n);
    await service.favorite('1', 42n);

    expect(prisma._favorites).toHaveLength(1);
  });

  it('unfavoriting a design that was never favorited succeeds without error', async () => {
    const prisma = createFakePrisma();
    const service = new DesignsService(prisma as never, createFakeAudit() as never);

    await expect(service.unfavorite('1', 42n)).resolves.toBeUndefined();
  });

  it('unfavorite removes only the calling customer favorite, leaving others intact', async () => {
    const prisma = createFakePrisma();
    const service = new DesignsService(prisma as never, createFakeAudit() as never);

    await service.favorite('1', 42n);
    await service.favorite('1', 99n);
    await service.unfavorite('1', 42n);

    expect(prisma._favorites).toEqual([{ customerId: 99n, designId: 1n }]);
  });
});
