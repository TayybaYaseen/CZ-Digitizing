import { sanitizeBankTransferConfig } from './bank-transfer-config.util';
import { toPublicSettingsDto } from './dto/settings.dto';

describe('sanitizeBankTransferConfig (AC-9 — bank details come from Admin Settings)', () => {
  it('keeps the bank fields, trimmed', () => {
    expect(
      sanitizeBankTransferConfig({ bankName: ' HBL ', accountTitle: 'CZ Digitizing', accountNumber: '1234567890', iban: 'PK36HABB0000001234567890', instructions: 'Use the order reference as the payment note.' }),
    ).toEqual({ bankName: 'HBL', accountTitle: 'CZ Digitizing', accountNumber: '1234567890', iban: 'PK36HABB0000001234567890', instructions: 'Use the order reference as the payment note.' });
  });

  it('drops empty, non-string and unknown keys (nothing provider-shaped survives)', () => {
    expect(sanitizeBankTransferConfig({ bankName: 'HBL', iban: '   ', accountEmail: 'pay@paypal.example', clientSecret: 'x', accountNumber: 42 })).toEqual({ bankName: 'HBL' });
  });

  it('returns null when nothing usable remains', () => {
    expect(sanitizeBankTransferConfig({ accountEmail: 'a@b.c' })).toBeNull();
    expect(sanitizeBankTransferConfig(null)).toBeNull();
    expect(sanitizeBankTransferConfig('nope')).toBeNull();
  });

  it('caps field lengths', () => {
    expect(sanitizeBankTransferConfig({ bankName: 'x'.repeat(500) })?.bankName).toHaveLength(120);
    expect(sanitizeBankTransferConfig({ instructions: 'x'.repeat(5000) })?.instructions).toHaveLength(1000);
  });
});

describe('public settings — bank transfer details', () => {
  const settings = { id: 1, whatsappNumber: null, contactEmail: null, domain: null, facebookUrl: null, instagramUrl: null, linkedinUrl: null, xTwitterUrl: null, youtubeUrl: null, experienceStartYear: 2016, updatedAt: new Date(), updatedByAdminId: null } as never;

  it('exposes only the whitelisted bank fields, and only while bank transfer is enabled', () => {
    const config = { bankName: 'HBL', iban: 'PK36', secretKey: 'must-not-leak' };
    const enabled = toPublicSettingsDto(settings, [{ id: 1n, method: 'bank_transfer', isEnabled: true, config, updatedAt: new Date() }]);
    expect(enabled.bankTransferConfig).toEqual({ bankName: 'HBL', iban: 'PK36' });

    const disabled = toPublicSettingsDto(settings, [{ id: 1n, method: 'bank_transfer', isEnabled: false, config, updatedAt: new Date() }]);
    expect(disabled.bankTransferConfig).toBeNull();
  });
});
