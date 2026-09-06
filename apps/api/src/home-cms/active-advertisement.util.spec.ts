import { resolveActiveAdvertisement } from './active-advertisement.util';

function ad(overrides: Partial<Parameters<typeof resolveActiveAdvertisement>[1][number]>) {
  return {
    id: '1',
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-3/AC-4/AC-5.
describe('resolveActiveAdvertisement', () => {
  const now = new Date('2026-06-15');

  it('returns null when no ad is active (AC-5)', () => {
    expect(resolveActiveAdvertisement(now, [])).toBeNull();
  });

  it('returns null when isActive=false even within the date window', () => {
    const ads = [ad({ isActive: false })];
    expect(resolveActiveAdvertisement(now, ads)).toBeNull();
  });

  it('returns null once endDate has passed (AC-4)', () => {
    const ads = [ad({ endDate: new Date('2026-06-14') })];
    expect(resolveActiveAdvertisement(now, ads)).toBeNull();
  });

  it('returns null before startDate', () => {
    const ads = [ad({ startDate: new Date('2026-06-16') })];
    expect(resolveActiveAdvertisement(now, ads)).toBeNull();
  });

  it('returns the ad when now is within [startDate, endDate] and isActive (AC-3)', () => {
    const ads = [ad({ id: '42' })];
    expect(resolveActiveAdvertisement(now, ads)?.id).toBe('42');
  });

  it('picks the most recently created ad when multiple are simultaneously active', () => {
    const ads = [ad({ id: 'old', createdAt: new Date('2026-01-01') }), ad({ id: 'new', createdAt: new Date('2026-06-01') })];
    expect(resolveActiveAdvertisement(now, ads)?.id).toBe('new');
  });
});
