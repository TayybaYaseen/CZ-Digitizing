import { I18nService } from './i18n.service';

function makeTranslation(locale: string, key: string, value: string) {
  return { id: 1n, locale, key, value, updatedAt: new Date(), updatedByAdminId: null };
}

function createFakePrisma(rows: ReturnType<typeof makeTranslation>[]) {
  return {
    uiTranslation: {
      findMany: jest.fn(async ({ where }: { where: { locale: string } }) => rows.filter((r) => r.locale === where.locale)),
    },
    language: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
  };
}

describe('I18nService.getTranslationBundle', () => {
  // AC-3 — a locale with no matching row for a key falls back to English rather than a blank/raw key.
  it('falls back to English for keys missing in the requested locale', async () => {
    const rows = [makeTranslation('en', 'nav.home', 'Home'), makeTranslation('en', 'nav.cart', 'Cart'), makeTranslation('ar', 'nav.home', 'الرئيسية')];
    const prisma = createFakePrisma(rows);
    const service = new I18nService(prisma as never, { record: jest.fn() } as never);

    const bundle = await service.getTranslationBundle('ar');

    expect(bundle['nav.home']).toEqual({ value: 'الرئيسية', isMachineTranslated: false });
    expect(bundle['nav.cart']).toEqual({ value: 'Cart', isMachineTranslated: false });
  });

  it('returns the English bundle directly when the requested locale is English', async () => {
    const rows = [makeTranslation('en', 'nav.home', 'Home')];
    const prisma = createFakePrisma(rows);
    const service = new I18nService(prisma as never, { record: jest.fn() } as never);

    const bundle = await service.getTranslationBundle('en');

    expect(bundle['nav.home']).toEqual({ value: 'Home', isMachineTranslated: false });
  });

  it('returns an empty bundle (no broken keys) for a locale with zero rows beyond English fallback', async () => {
    const rows = [makeTranslation('en', 'nav.home', 'Home')];
    const prisma = createFakePrisma(rows);
    const service = new I18nService(prisma as never, { record: jest.fn() } as never);

    const bundle = await service.getTranslationBundle('es');

    expect(bundle['nav.home']).toEqual({ value: 'Home', isMachineTranslated: false });
  });
});
