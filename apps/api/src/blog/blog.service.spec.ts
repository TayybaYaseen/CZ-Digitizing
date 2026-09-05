import { BlogService } from './blog.service';

function createFakePrisma(existingSlugs: string[]) {
  return {
    blogPost: {
      findUnique: jest.fn(async ({ where }: { where: { slug: string } }) => (existingSlugs.includes(where.slug) ? { slug: where.slug } : null)),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1n, createdAt: new Date(), updatedAt: new Date(), ...data })),
    },
  };
}

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-9/AC-15.
describe('BlogService.create', () => {
  it('rejects a duplicate slug (AC-9 unique slug)', async () => {
    const service = new BlogService(createFakePrisma(['my-post']) as never, { record: jest.fn() } as never);

    await expect(
      service.create({ title: 'Title', slug: 'my-post', body: 'body', category: 'tips' }, { sub: '1' } as never),
    ).rejects.toMatchObject({ code: 'SLUG_ALREADY_EXISTS' });
  });

  it('sets publishedAt when created already published', async () => {
    const service = new BlogService(createFakePrisma([]) as never, { record: jest.fn() } as never);

    const result = await service.create({ title: 'Title', slug: 'new-post', body: 'body', category: 'tips', isPublished: true }, { sub: '1' } as never);

    expect(result.publishedAt).not.toBeNull();
  });

  it('leaves publishedAt null for a draft', async () => {
    const service = new BlogService(createFakePrisma([]) as never, { record: jest.fn() } as never);

    const result = await service.create({ title: 'Title', slug: 'draft-post', body: 'body', category: 'tips' }, { sub: '1' } as never);

    expect(result.publishedAt).toBeNull();
  });
});
