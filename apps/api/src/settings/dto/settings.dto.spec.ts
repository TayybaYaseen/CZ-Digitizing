import { toPublicSettingsDto, toSettingsDto } from './settings.dto';

function makeSettings(overrides: Partial<Parameters<typeof toSettingsDto>[0]> = {}) {
  return {
    id: 1,
    whatsappNumber: '+92 317 4604508',
    contactEmail: 'czdigitizing@gmail.com',
    domain: 'czdigitizing.com',
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    xTwitterUrl: null,
    youtubeUrl: null,
    experienceStartYear: 2016,
    updatedAt: new Date(),
    updatedByAdminId: null,
    ...overrides,
  } as never;
}

describe('settings.dto (AC-3, AC-4)', () => {
  it('omits a social field entirely when the underlying URL is empty (AC-3 — hides the icon)', () => {
    const dto = toSettingsDto(makeSettings(), []);
    expect(dto.social).toEqual({});
  });

  it('includes only the social fields that have a value set', () => {
    const dto = toSettingsDto(makeSettings({ facebookUrl: 'https://facebook.com/czd', youtubeUrl: null }), []);
    expect(dto.social).toEqual({ facebook: 'https://facebook.com/czd' });
  });

  it('computes years of experience as current_year - experience_start_year (AC-4)', () => {
    const currentYear = new Date().getFullYear();
    const dto = toPublicSettingsDto(makeSettings({ experienceStartYear: currentYear - 10 }));
    expect(dto.yearsOfExperience).toBe(10);
  });

  it('the public DTO never includes contactEmail or paymentMethods', () => {
    const dto = toPublicSettingsDto(makeSettings());
    expect(dto).not.toHaveProperty('contactEmail');
    expect(dto).not.toHaveProperty('paymentMethods');
  });
});
