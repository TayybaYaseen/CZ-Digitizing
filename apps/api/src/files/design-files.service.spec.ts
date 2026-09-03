import { DesignFilesService } from './design-files.service';

const DST_FORMAT = { id: 1n, extension: 'DST', isPrivate: false, isLocked: false, isActive: true, maxFileSizeMb: 50 };
const EMB_FORMAT = { id: 2n, extension: 'EMB', isPrivate: true, isLocked: true, isActive: true, maxFileSizeMb: 50 };

function createFakePrisma() {
  const designFiles: Record<string, unknown>[] = [];
  let nextId = 1n;

  return {
    design: { findFirst: jest.fn(async () => ({ id: 1n, deletedAt: null })) },
    allowedFileFormat: { findMany: jest.fn(async () => [DST_FORMAT, EMB_FORMAT]) },
    designFile: {
      aggregate: jest.fn(async () => ({ _sum: { fileSizeBytes: 0n } })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId++, versionNumber: 1, supersededByFileId: null, createdAt: new Date(), ...data };
        designFiles.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; designId: bigint } }) =>
        designFiles.find((f) => f.id === where.id && f.designId === where.designId) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { id?: { in: bigint[] } } }) =>
        designFiles.filter((f) => !where.id || where.id.in.includes(f.id as bigint)),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = designFiles.find((f) => f.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        const idx = designFiles.findIndex((f) => f.id === where.id);
        designFiles.splice(idx, 1);
      }),
    },
    _designFiles: designFiles,
  };
}

function createFakeStorage() {
  return {
    hashContent: jest.fn((buf: Buffer) => `hash-${buf.length}`),
    save: jest.fn(async (_buf: Buffer, hash: string) => `/private/${hash}`),
  };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

const admin = { sub: '1' } as never;

describe('DesignFilesService (AC-1, AC-2, AC-7, AC-12)', () => {
  it('forces isPrivate=true for an .EMB upload regardless of the format registry default (AC-1)', async () => {
    const prisma = createFakePrisma();
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);

    const [dto] = await service.upload('1', [{ originalname: 'Rose.emb', mimetype: 'application/octet-stream', buffer: Buffer.alloc(100) }], admin);

    expect(dto.isPrivate).toBe(true);
    expect(dto.fileFormat).toBe('EMB');
  });

  it('rejects an extension not present in the active allowed-format registry (AC-13 gate)', async () => {
    const prisma = createFakePrisma();
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);

    await expect(
      service.upload('1', [{ originalname: 'Rose.xyz', mimetype: 'application/octet-stream', buffer: Buffer.alloc(100) }], admin),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });

  it('rejects a file exceeding the per-format max size (AC-7)', async () => {
    const prisma = createFakePrisma();
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);
    const tooLarge = Buffer.alloc(51 * 1024 * 1024);

    await expect(service.upload('1', [{ originalname: 'Rose.dst', mimetype: 'x', buffer: tooLarge }], admin)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('rejects an upload that would push the design over the 250MB total limit (AC-7)', async () => {
    const prisma = createFakePrisma();
    prisma.designFile.aggregate = jest.fn(async () => ({ _sum: { fileSizeBytes: BigInt(240 * 1024 * 1024) } }));
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);
    const file = Buffer.alloc(20 * 1024 * 1024);

    await expect(service.upload('1', [{ originalname: 'Rose.dst', mimetype: 'x', buffer: file }], admin)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('replacing a file creates a new row and points the old one at it via supersededByFileId, not an overwrite (AC-12)', async () => {
    const prisma = createFakePrisma();
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);

    const [original] = await service.upload('1', [{ originalname: 'Rose.dst', mimetype: 'x', buffer: Buffer.alloc(100) }], admin);
    const replaced = await service.replace('1', original.id, { originalname: 'Rose-v2.dst', mimetype: 'x', buffer: Buffer.alloc(200) }, admin);

    expect(prisma._designFiles).toHaveLength(2); // both versions retained, not overwritten
    const oldRow = prisma._designFiles.find((f) => (f as { id: bigint }).id.toString() === original.id) as { supersededByFileId: bigint };
    expect(oldRow.supersededByFileId.toString()).toBe(replaced.id);
    expect(replaced.versionNumber).toBe(2);
  });

  it('does not claim content-validated for a format with no known magic-byte signature (honest gap, AC risk #1)', async () => {
    const prisma = createFakePrisma();
    const service = new DesignFilesService(prisma as never, createFakeStorage() as never, createFakeAudit() as never);

    const [dto] = await service.upload('1', [{ originalname: 'Rose.emb', mimetype: 'x', buffer: Buffer.alloc(100) }], admin);

    expect(dto.contentValidated).toBe(false);
  });
});
