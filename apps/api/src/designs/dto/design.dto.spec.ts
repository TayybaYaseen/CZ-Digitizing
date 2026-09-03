import { toDesignDetailDto, toDesignSummaryDto } from './design.dto';

function makeDesign(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    name: 'Rose Bouquet',
    description: 'A rose design',
    previewImageUrl: 'https://example.com/preview.png',
    galleryImageUrls: [],
    subcategoryId: null,
    vectorImageUrl: null,
    vectorVideoUrl: null,
    embroideryImageUrl: null,
    embroideryVideoUrl: null,
    autoSwapEnabled: false,
    tags: ['floral'],
    pricePkr: '500.00',
    salePricePkr: null,
    discountBadge: null,
    stitchCount: 1000,
    threadColorCount: 5,
    threadColorChanges: 4,
    categoryAssignments: [],
    sizes: [],
    favorites: [],
    ...overrides,
  } as never;
}

describe('design.dto (AC-2, AC-8)', () => {
  it('appears under every assigned category, not just the first (AC-2)', () => {
    const design = makeDesign({
      categoryAssignments: [{ categoryId: 10n }, { categoryId: 20n }, { categoryId: 30n }],
    });
    const dto = toDesignSummaryDto(design);
    expect(dto.categoryIds).toEqual(['10', '20', '30']);
  });

  it('isFavorited is true only when the current customer has a matching favorite row', () => {
    const design = makeDesign({ favorites: [{ customerId: 42n }] });
    expect(toDesignSummaryDto(design, 42n).isFavorited).toBe(true);
    expect(toDesignSummaryDto(design, 99n).isFavorited).toBe(false);
    expect(toDesignSummaryDto(design).isFavorited).toBe(false);
  });

  it('detail DTO sorts sizes by sizeOrder and converts Decimal fields to numbers', () => {
    const design = makeDesign({
      sizes: [
        { id: 2n, sizeLabel: 'Size 2', sizeWidthMm: '100.00', sizeHeightMm: '80.00', sizeOrder: 1 },
        { id: 1n, sizeLabel: 'Size 1', sizeWidthMm: '50.00', sizeHeightMm: '40.00', sizeOrder: 0 },
      ],
    });
    const dto = toDesignDetailDto(design);
    expect(dto.sizes.map((s) => s.label)).toEqual(['Size 1', 'Size 2']);
    expect(dto.sizes[0]).toEqual({ id: '1', label: 'Size 1', widthMm: 50, heightMm: 40 });
  });
});
