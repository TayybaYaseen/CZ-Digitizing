import { Injectable } from '@nestjs/common';
import type { TranslationBundleDto } from '@czd/shared-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toLanguageDto } from './dto/language.dto';
import type { UpsertLanguageDto } from './dto/upsert-language.dto';
import type { UpsertTranslationsDto } from './dto/upsert-translations.dto';

const FALLBACK_LOCALE = 'en';

// docs/specs/2026-08-28-16-internationalization.md §3/§4 (aspect A-021).
@Injectable()
export class I18nService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listLanguages(includeDisabled = false) {
    const rows = await this.prisma.language.findMany({
      where: includeDisabled ? {} : { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toLanguageDto);
  }

  // AC-6 — enabling/configuring a language is a plain upsert; adding a brand-new one is this same
  // call with a code that doesn't exist yet. No schema change, no deploy.
  async upsertLanguage(code: string, dto: UpsertLanguageDto, admin: AccessTokenPayload) {
    const before = await this.prisma.language.findUnique({ where: { code } });
    const row = await this.prisma.language.upsert({
      where: { code },
      create: { code, ...dto },
      update: { ...dto },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: before ? 'LANGUAGE_UPDATED' : 'LANGUAGE_CREATED',
      resourceType: 'language',
      resourceId: code,
      changes: { before, after: row },
    });
    return toLanguageDto(row);
  }

  // AC-3 — every key in the requested locale, falling back to English for anything missing.
  // Never returns a blank value or a raw key for a key that exists in English.
  async getTranslationBundle(locale: string): Promise<TranslationBundleDto> {
    const [localeRows, fallbackRows] = await Promise.all([
      locale === FALLBACK_LOCALE ? Promise.resolve([]) : this.prisma.uiTranslation.findMany({ where: { locale } }),
      this.prisma.uiTranslation.findMany({ where: { locale: FALLBACK_LOCALE } }),
    ]);

    const bundle: TranslationBundleDto = {};
    for (const row of fallbackRows) {
      bundle[row.key] = { value: row.value, isMachineTranslated: false };
    }
    for (const row of localeRows) {
      bundle[row.key] = { value: row.value, isMachineTranslated: false };
    }
    return bundle;
  }

  async upsertTranslations(locale: string, dto: UpsertTranslationsDto, admin: AccessTokenPayload) {
    const language = await this.prisma.language.findUnique({ where: { code: locale } });
    if (!language) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Unknown language code');

    const entries = Object.entries(dto.entries);
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.uiTranslation.upsert({
          where: { locale_key: { locale, key } },
          create: { locale, key, value, updatedByAdminId: BigInt(admin.sub) },
          update: { value, updatedByAdminId: BigInt(admin.sub) },
        }),
      ),
    );

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'UI_TRANSLATIONS_UPDATED',
      resourceType: 'ui_translations',
      resourceId: locale,
      changes: { keys: Object.keys(dto.entries) },
    });

    return this.getTranslationBundle(locale);
  }

  // AC-4 — persists a logged-in customer's language choice across visits.
  async setPreferredLocale(userId: bigint, locale: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { preferredLocale: locale } });
    return { preferredLocale: locale };
  }
}
