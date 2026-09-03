import { FileFormatService } from './file-format.service';

function createFakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  let nextId = 2n; // id 1 is reserved for the seeded EMB row below
  rows.set('1', { id: 1n, extension: 'EMB', displayName: 'Wilcom EMB', isPrivate: true, isLocked: true, isActive: true, maxFileSizeMb: 50 });

  return {
    allowedFileFormat: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }: { where: { extension?: string; id?: bigint } }) => {
        if (where.extension) return [...rows.values()].find((r) => r.extension === where.extension) ?? null;
        return rows.get(where.id!.toString()) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        // isLocked defaults to false at the DB level for every non-seeded row — mirrored here.
        const row = { id: nextId++, isLocked: false, ...data };
        rows.set(row.id.toString(), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = rows.get(where.id.toString())!;
        for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
        return row;
      }),
    },
    _rows: rows,
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

const admin = { sub: '1' } as never;

describe('FileFormatService (AC-13, AC-14)', () => {
  it('creates a new active format extension without any code change (AC-13)', async () => {
    const prisma = createFakePrisma();
    const service = new FileFormatService(prisma as never, createFakeAudit() as never);

    const dto = await service.create({ extension: 'jpx', displayName: 'Future Format JPX' }, admin);

    expect(dto.extension).toBe('JPX');
    expect(dto.isLocked).toBe(false);
  });

  it('rejects setting isPrivate=false on the locked EMB row via update (AC-14)', async () => {
    const prisma = createFakePrisma();
    const service = new FileFormatService(prisma as never, createFakeAudit() as never);

    await expect(service.update('1', { isPrivate: false }, admin)).rejects.toMatchObject({ code: 'FILE_FORMAT_BLOCKED' });
    expect((prisma._rows.get('1') as { isPrivate: boolean }).isPrivate).toBe(true); // unchanged
  });

  it('allows updating displayName/maxFileSizeMb on the locked EMB row without touching isPrivate/isLocked (AC-14)', async () => {
    const prisma = createFakePrisma();
    const service = new FileFormatService(prisma as never, createFakeAudit() as never);

    const dto = await service.update('1', { displayName: 'Wilcom EMB (locked)' }, admin);

    expect(dto.displayName).toBe('Wilcom EMB (locked)');
    expect(dto.isPrivate).toBe(true);
    expect(dto.isLocked).toBe(true);
  });

  it('allows updating isPrivate on a non-locked format normally', async () => {
    const prisma = createFakePrisma();
    const service = new FileFormatService(prisma as never, createFakeAudit() as never);
    await service.create({ extension: 'ABC', displayName: 'Test Format' }, admin);

    const dto = await service.update('2', { isPrivate: true }, admin);

    expect(dto.isPrivate).toBe(true);
  });

  it('rejects creating a format with a duplicate extension', async () => {
    const prisma = createFakePrisma();
    const service = new FileFormatService(prisma as never, createFakeAudit() as never);

    await expect(service.create({ extension: 'EMB', displayName: 'Duplicate' }, admin)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
