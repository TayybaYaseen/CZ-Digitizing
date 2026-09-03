import { Injectable } from '@nestjs/common';
import type { Prisma, PlatformSettings } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateContactDto } from './dto/update-contact.dto';
import type { UpdateDomainDto } from './dto/update-domain.dto';
import type { UpdateExperienceDto } from './dto/update-experience.dto';
import type { UpdatePaymentMethodsDto } from './dto/update-payment-methods.dto';
import type { UpdateSocialDto } from './dto/update-social.dto';
import { toPublicSettingsDto, toSettingsDto, type PublicSettingsDto, type SettingsDto } from './dto/settings.dto';

const SETTINGS_ID = 1;

// docs/specs/2026-08-28-03-admin-platform-settings.md (aspect A-005/A-005a/A-005b/A-005c).
// platform_settings is a true singleton (always id=1), seeded by the AddPlatformSettings
// migration so this row always exists — every method here assumes it does.
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(): Promise<SettingsDto> {
    const [settings, paymentMethods] = await Promise.all([
      this.prisma.platformSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } }),
      this.prisma.paymentMethodSetting.findMany(),
    ]);
    return toSettingsDto(settings, paymentMethods);
  }

  async getPublic(): Promise<PublicSettingsDto> {
    const [settings, paymentMethods] = await Promise.all([
      this.prisma.platformSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } }),
      this.prisma.paymentMethodSetting.findMany(),
    ]);
    return toPublicSettingsDto(settings, paymentMethods);
  }

  async updateContact(dto: UpdateContactDto, admin: AccessTokenPayload): Promise<SettingsDto> {
    return this.applyUpdate(
      { whatsappNumber: dto.whatsappNumber, contactEmail: dto.contactEmail },
      admin,
    );
  }

  async updateSocial(dto: UpdateSocialDto, admin: AccessTokenPayload): Promise<SettingsDto> {
    return this.applyUpdate(
      {
        facebookUrl: dto.facebookUrl ?? null,
        instagramUrl: dto.instagramUrl ?? null,
        linkedinUrl: dto.linkedinUrl ?? null,
        xTwitterUrl: dto.xTwitterUrl ?? null,
        youtubeUrl: dto.youtubeUrl ?? null,
      },
      admin,
    );
  }

  async updateExperience(dto: UpdateExperienceDto, admin: AccessTokenPayload): Promise<SettingsDto> {
    return this.applyUpdate({ experienceStartYear: dto.experienceStartYear }, admin);
  }

  async updateDomain(dto: UpdateDomainDto, admin: AccessTokenPayload): Promise<SettingsDto> {
    return this.applyUpdate({ domain: dto.domain }, admin);
  }

  // AC-2 — updates take effect for the next checkout only; past order records are untouched
  // because they're never re-read from this table (A-013 snapshots payment details at order
  // time once that aspect exists — nothing here rewrites history).
  async updatePaymentMethods(dto: UpdatePaymentMethodsDto, admin: AccessTokenPayload): Promise<SettingsDto> {
    const before = await this.prisma.paymentMethodSetting.findMany();

    await this.prisma.$transaction(
      dto.methods.map((entry) =>
        this.prisma.paymentMethodSetting.upsert({
          where: { method: entry.method },
          create: { method: entry.method, isEnabled: entry.isEnabled, config: entry.config as Prisma.InputJsonValue | undefined },
          update: { isEnabled: entry.isEnabled, config: entry.config as Prisma.InputJsonValue | undefined },
        }),
      ),
    );

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'SETTINGS_PAYMENT_METHODS_UPDATED',
      resourceType: 'payment_method_settings',
      changes: { before, after: dto.methods },
    });

    return this.get();
  }

  private async applyUpdate(data: Partial<PlatformSettings>, admin: AccessTokenPayload): Promise<SettingsDto> {
    const before = await this.prisma.platformSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });

    const updated = await this.prisma.platformSettings.update({
      where: { id: SETTINGS_ID },
      data: { ...data, updatedByAdminId: BigInt(admin.sub) },
    });

    // AC-6 — every settings write is audit-logged with a before/after diff of only the changed fields.
    const changes = this.diff(before, updated);
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'SETTINGS_UPDATED',
      resourceType: 'platform_settings',
      resourceId: String(SETTINGS_ID),
      changes,
    });

    const paymentMethods = await this.prisma.paymentMethodSetting.findMany();
    return toSettingsDto(updated, paymentMethods);
  }

  private diff(before: PlatformSettings, after: PlatformSettings): Record<string, { before: unknown; after: unknown }> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(after) as (keyof PlatformSettings)[]) {
      if (key === 'updatedAt' || key === 'updatedByAdminId') continue;
      const beforeValue = before[key];
      const afterValue = after[key];
      if (beforeValue !== afterValue) changes[key] = { before: beforeValue, after: afterValue };
    }
    return changes;
  }
}
