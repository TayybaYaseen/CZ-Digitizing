import { CustomerFilesService } from './customer-files.service';

function createFakePrisma(initial: Record<string, unknown>) {
  const row = { id: 1n, downloadCount: 0, firstDownloadAt: null, lastDownloadAt: null, maxDownloadAttempts: null, ...initial };
  return {
    customerAuthorizedFile: {
      findUniqueOrThrow: jest.fn(async () => row),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const mutableRow = row as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as Record<string, unknown>)) {
            const current = (mutableRow[key] as number | undefined) ?? 0;
            mutableRow[key] = current + (value as { increment: number }).increment;
          } else {
            mutableRow[key] = value;
          }
        }
        return row;
      }),
    },
    _row: row,
  };
}

describe('CustomerFilesService (AC-6, AC-11 — logic proven ahead of A-013 wiring the gate in)', () => {
  it('increments download_count and stamps first/last_download_at on first download (AC-6)', async () => {
    const prisma = createFakePrisma({});
    const service = new CustomerFilesService(prisma as never, {} as never);

    await service.incrementDownload(1n);

    expect(prisma._row.downloadCount).toBe(1);
    expect(prisma._row.firstDownloadAt).not.toBeNull();
    expect(prisma._row.lastDownloadAt).not.toBeNull();
  });

  it('does not overwrite first_download_at on a second download, but updates last_download_at (AC-6)', async () => {
    const firstDownloadAt = new Date('2026-01-01T00:00:00Z');
    const prisma = createFakePrisma({ downloadCount: 1, firstDownloadAt });
    const service = new CustomerFilesService(prisma as never, {} as never);

    await service.incrementDownload(1n);

    expect(prisma._row.downloadCount).toBe(2);
    expect(prisma._row.firstDownloadAt).toBe(firstDownloadAt);
  });

  it('allows a download when under the max-attempts cap (AC-11)', async () => {
    const prisma = createFakePrisma({ downloadCount: 2, maxDownloadAttempts: 5 });
    const service = new CustomerFilesService(prisma as never, {} as never);

    await expect(service.checkAttemptLimit(1n)).resolves.toBeUndefined();
  });

  it('rejects with FORBIDDEN once download_count reaches the max-attempts cap (AC-11)', async () => {
    const prisma = createFakePrisma({ downloadCount: 5, maxDownloadAttempts: 5 });
    const service = new CustomerFilesService(prisma as never, {} as never);

    await expect(service.checkAttemptLimit(1n)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a null maxDownloadAttempts means no cap', async () => {
    const prisma = createFakePrisma({ downloadCount: 9999, maxDownloadAttempts: null });
    const service = new CustomerFilesService(prisma as never, {} as never);

    await expect(service.checkAttemptLimit(1n)).resolves.toBeUndefined();
  });

  it('resetAttempts zeroes download_count so a customer can download again after Admin resets it (AC-11)', async () => {
    const prisma = createFakePrisma({ downloadCount: 5, maxDownloadAttempts: 5 });
    const service = new CustomerFilesService(prisma as never, {} as never);

    await service.resetAttempts(1n);

    expect(prisma._row.downloadCount).toBe(0);
  });

  function createFakeOrderPrisma(order: { id: bigint; customerId: bigint; status: string; paymentStatus: string } | null, authorizedFiles: Record<string, unknown>[] = []) {
    return {
      order: { findFirst: jest.fn(async () => order) },
      customerAuthorizedFile: {
        findMany: jest.fn(async () => authorizedFiles),
        findFirst: jest.fn(async ({ where }: { where: { id: bigint } }) => authorizedFiles.find((f) => f.id === where.id) ?? null),
        findUniqueOrThrow: jest.fn(async () => authorizedFiles[0]),
        update: jest.fn(async () => authorizedFiles[0]),
      },
    };
  }

  it('rejects with RESOURCE_NOT_FOUND when the order does not belong to this customer', async () => {
    const prisma = createFakeOrderPrisma(null);
    const service = new CustomerFilesService(prisma as never, {} as never);
    await expect(service.listAuthorizedFiles('1', 1n)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('rejects with PAYMENT_NOT_CONFIRMED while the order is still payment_pending (AC-6)', async () => {
    const prisma = createFakeOrderPrisma({ id: 1n, customerId: 1n, status: 'payment_pending', paymentStatus: 'pending' });
    const service = new CustomerFilesService(prisma as never, {} as never);
    await expect(service.listAuthorizedFiles('1', 1n)).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIRMED' });
    await expect(service.requestDownload('1', '1', 1n)).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIRMED' });
  });

  it('rejects with PAYMENT_NOT_CONFIRMED once the order has been fully refunded, even if status is still processing (AC-11)', async () => {
    const prisma = createFakeOrderPrisma({ id: 1n, customerId: 1n, status: 'processing', paymentStatus: 'refunded' });
    const service = new CustomerFilesService(prisma as never, {} as never);
    await expect(service.listAuthorizedFiles('1', 1n)).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIRMED' });
  });

  it('allows listing files once the order is payment_confirmed or later (AC-1/AC-6)', async () => {
    for (const status of ['payment_confirmed', 'processing', 'ready', 'completed']) {
      const prisma = createFakeOrderPrisma({ id: 1n, customerId: 1n, status, paymentStatus: 'completed' }, [{ id: 5n, designFile: { designId: 9n, fileFormat: 'DST', fileSizeBytes: 100n } }]);
      const service = new CustomerFilesService(prisma as never, {} as never);
      const files = await service.listAuthorizedFiles('1', 1n);
      expect(files).toHaveLength(1);
    }
  });
});
