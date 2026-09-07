import { AccountService } from './account.service';

interface FakeOrderItem {
  order: { id: bigint; createdAt: Date };
  design: { id: bigint; name: string; previewImageUrl: string } | null;
  bundle: { id: bigint; name: string; previewImageUrl: string | null } | null;
}

function createFakePrisma(items: FakeOrderItem[]) {
  return {
    orderItem: {
      findMany: jest.fn(async () => items),
    },
  };
}

describe('AccountService.listPurchasedDesigns (AC-2)', () => {
  it('de-duplicates a design bought across two separate orders into one row with two purchases', async () => {
    const design = { id: 1n, name: 'Rose Motif', previewImageUrl: 'https://x/rose.png' };
    const items: FakeOrderItem[] = [
      { order: { id: 10n, createdAt: new Date('2026-01-01') }, design, bundle: null },
      { order: { id: 11n, createdAt: new Date('2026-02-01') }, design, bundle: null },
    ];
    const service = new AccountService(createFakePrisma(items) as never, {} as never);

    const result = await service.listPurchasedDesigns(1n);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'design', id: '1', name: 'Rose Motif' });
    expect(result[0]!.purchases).toEqual([
      { orderId: '10', purchasedAt: new Date('2026-01-01').toISOString() },
      { orderId: '11', purchasedAt: new Date('2026-02-01').toISOString() },
    ]);
  });

  it('unions individual-design and bundle purchases into separate rows', async () => {
    const design = { id: 1n, name: 'Rose Motif', previewImageUrl: 'https://x/rose.png' };
    const bundle = { id: 2n, name: 'Floral Bundle', previewImageUrl: null };
    const items: FakeOrderItem[] = [
      { order: { id: 10n, createdAt: new Date('2026-01-01') }, design, bundle: null },
      { order: { id: 10n, createdAt: new Date('2026-01-01') }, design: null, bundle },
    ];
    const service = new AccountService(createFakePrisma(items) as never, {} as never);

    const result = await service.listPurchasedDesigns(1n);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.type).sort()).toEqual(['bundle', 'design']);
  });

  it('returns an empty list for a customer with no order items', async () => {
    const service = new AccountService(createFakePrisma([]) as never, {} as never);

    const result = await service.listPurchasedDesigns(1n);

    expect(result).toEqual([]);
  });
});
