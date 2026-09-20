import type { PaymentMethodSetting, PlatformSettings } from '../../generated/prisma';
import { sanitizeBankTransferConfig } from '../bank-transfer-config.util';

export interface SettingsDto {
  whatsappNumber: string | null;
  contactEmail: string | null;
  domain: string | null;
  social: {
    facebook?: string;
    instagram?: string;
    linkedIn?: string;
    xTwitter?: string;
    youTube?: string;
  };
  experienceStartYear: number;
  paymentMethods: { method: string; isEnabled: boolean; config: Record<string, unknown> | null }[];
}

// spec §3 SettingsDto — empty/null social fields are simply omitted (AC-3: absence = hidden icon).
export function toSettingsDto(settings: PlatformSettings, paymentMethods: PaymentMethodSetting[]): SettingsDto {
  return {
    whatsappNumber: settings.whatsappNumber,
    contactEmail: settings.contactEmail,
    domain: settings.domain,
    social: {
      ...(settings.facebookUrl ? { facebook: settings.facebookUrl } : {}),
      ...(settings.instagramUrl ? { instagram: settings.instagramUrl } : {}),
      ...(settings.linkedinUrl ? { linkedIn: settings.linkedinUrl } : {}),
      ...(settings.xTwitterUrl ? { xTwitter: settings.xTwitterUrl } : {}),
      ...(settings.youtubeUrl ? { youTube: settings.youtubeUrl } : {}),
    },
    experienceStartYear: settings.experienceStartYear,
    paymentMethods: paymentMethods.map((m) => ({
      method: m.method,
      isEnabled: m.isEnabled,
      config: m.method === 'bank_transfer' ? sanitizeBankTransferConfig(m.config) : ((m.config as Record<string, unknown> | null) ?? null),
    })),
  };
}

export interface PublicSettingsDto {
  whatsappNumber: string | null;
  // SRS §15/§18 — the business contact email is explicitly named as public-facing (Contact page,
  // footer), unlike bank/payment secrets — this is the one deliberate exception to "no contactEmail
  // here" below.
  contactEmail: string | null;
  social: SettingsDto['social'];
  domain: string | null;
  yearsOfExperience: number;
  // docs/specs/2026-08-28-08-orders-payment-processing.md AC-3/AC-9 — the bank account a customer
  // transfers PKR into (bankName, accountTitle, accountNumber, iban, instructions), as configured by
  // Admin in Settings. The bank-transfer payment page (apps/web/app/checkout/bank-transfer/[id]) reads
  // it live, so an Admin change applies to the next page view with no deploy. Only that whitelisted
  // set of fields is ever returned, and only while bank transfer is enabled.
  bankTransferConfig: Record<string, unknown> | null;
}

// AC-1/AC-3/AC-4 — the non-sensitive subset every public page (footer, Contact, WhatsApp
// click-to-chat) reads. contactEmail is public by design (SRS §15/§18); full paymentMethods list
// is not — bankTransferConfig is the one deliberate, narrow exception (see its own comment above).
export function toPublicSettingsDto(settings: PlatformSettings, paymentMethods: PaymentMethodSetting[] = []): PublicSettingsDto {
  const dto = toSettingsDto(settings, paymentMethods);
  const bankTransfer = paymentMethods.find((m) => m.method === 'bank_transfer');
  return {
    whatsappNumber: dto.whatsappNumber,
    contactEmail: dto.contactEmail,
    social: dto.social,
    domain: dto.domain,
    yearsOfExperience: new Date().getFullYear() - settings.experienceStartYear,
    bankTransferConfig: bankTransfer?.isEnabled ? sanitizeBankTransferConfig(bankTransfer.config) : null,
  };
}
