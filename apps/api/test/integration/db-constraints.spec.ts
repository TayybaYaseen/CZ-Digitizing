import { PrismaService } from '../../src/prisma/prisma.service';

// Requires a real Postgres reachable via DATABASE_URL in apps/api/.env, with `prisma migrate dev`
// already applied. Run with: pnpm --filter @czd/api test:integration
//
// docs/specs/2026-08-28-05-private-file-management.md AC-2/AC-14 — these two CHECK constraints are
// the load-bearing DB-level backstops for this spec's highest-risk guarantees. Tested here via raw
// SQL, bypassing every application-layer check (DesignFilesService, FileFormatService), because
// the whole point is proving Postgres itself refuses the write — not that our code remembered to.
describe('Private file management DB constraints (AC-2, AC-14)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.customerAuthorizedFile.deleteMany();
    await prisma.designFile.deleteMany();
    await prisma.design.deleteMany();
  });

  async function createDesign() {
    return prisma.design.create({ data: { name: 'Constraint Test Design', previewImageUrl: 'https://example.com/p.png', pricePkr: 100 } });
  }

  // AC-2
  it('rejects a raw INSERT setting file_format=EMB with is_private=false (emb_never_public)', async () => {
    const design = await createDesign();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO design_files (design_id, file_format, storage_path, file_size_bytes, upload_hash, is_private) VALUES ($1, 'EMB', '/x', 100, 'hash-emb-1', false)`,
        design.id,
      ),
    ).rejects.toThrow(/emb_never_public/);
  });

  it('allows file_format=EMB with is_private=true (the only valid combination)', async () => {
    const design = await createDesign();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO design_files (design_id, file_format, storage_path, file_size_bytes, upload_hash, is_private) VALUES ($1, 'EMB', '/x', 100, 'hash-emb-2', true)`,
        design.id,
      ),
    ).resolves.toBeDefined();
  });

  it('allows a non-EMB format with is_private=false', async () => {
    const design = await createDesign();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO design_files (design_id, file_format, storage_path, file_size_bytes, upload_hash, is_private) VALUES ($1, 'DST', '/x', 100, 'hash-dst-1', false)`,
        design.id,
      ),
    ).resolves.toBeDefined();
  });

  // AC-14
  it('rejects a raw UPDATE setting is_private=false on the locked EMB row (locked_format_stays_private)', async () => {
    await expect(prisma.$executeRawUnsafe(`UPDATE allowed_file_formats SET is_private = false WHERE extension = 'EMB'`)).rejects.toThrow(
      /locked_format_stays_private/,
    );
  });

  it('rejects a raw UPDATE that would create a locked+non-private row from any extension', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO allowed_file_formats (extension, display_name, is_private, is_locked, updated_at) VALUES ('ZZZ', 'Test Locked Format', true, true, NOW())`,
    );

    await expect(prisma.$executeRawUnsafe(`UPDATE allowed_file_formats SET is_private = false WHERE extension = 'ZZZ'`)).rejects.toThrow(
      /locked_format_stays_private/,
    );

    await prisma.$executeRawUnsafe(`DELETE FROM allowed_file_formats WHERE extension = 'ZZZ'`);
  });

  it('allows updating is_private on a non-locked format', async () => {
    await expect(prisma.$executeRawUnsafe(`UPDATE allowed_file_formats SET is_private = true WHERE extension = 'DST'`)).resolves.toBeDefined();
    await prisma.$executeRawUnsafe(`UPDATE allowed_file_formats SET is_private = false WHERE extension = 'DST'`); // restore
  });
});
