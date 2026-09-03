import type { PaymentMethodSetting, PlatformSettings } from '../../generated/prisma';

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
      config: (m.config as Record<string, unknown> | null) ?? null,
    })),
  };
}

export interface PublicSettingsDto {
  whatsappNumber: string | null;
  social: SettingsDto['social'];
  domain: string | null;
  yearsOfExperience: number;
  // docs/specs/2026-08-28-08-orders-payment-processing.md AC-3/AC-9 — the bank-transfer checkout
  // page (apps/web/app/checkout/bank-transfer/[id]) needs Admin's non-secret display config (bank
  // name/account title/account number for the customer to transfer to) with no deploy, but a
  // customer has no business seeing every payment method's full admin config (SettingsDto.paymentMethods
  // is intentionally admin-only) — this is that one method's config, and only when it's enabled.
  bankTransferConfig: Record<string, unknown> | null;
}

// AC-1/AC-3/AC-4 — the non-sensitive subset every public page (footer, Contact, WhatsApp
// click-to-chat) reads. No contactEmail/full paymentMethods list here — those aren't "public"
// values; bankTransferConfig is the one deliberate, narrow exception (see its own comment above).
export function toPublicSettingsDto(settings: PlatformSettings, paymentMethods: PaymentMethodSetting[] = []): PublicSettingsDto {
  const dto = toSettingsDto(settings, paymentMethods);
  const bankTransfer = paymentMethods.find((m) => m.method === 'bank_transfer');
  return {
    whatsappNumber: dto.whatsappNumber,
    social: dto.social,
    domain: dto.domain,
    yearsOfExperience: new Date().getFullYear() - settings.experienceStartYear,
    bankTransferConfig: bankTransfer?.isEnabled ? ((bankTransfer.config as Record<string, unknown> | null) ?? null) : null,
  };
}
