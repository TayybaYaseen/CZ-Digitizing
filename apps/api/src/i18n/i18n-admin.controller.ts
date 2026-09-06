import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { UpsertLanguageDto } from './dto/upsert-language.dto';
import { UpsertTranslationsDto } from './dto/upsert-translations.dto';
import { I18nService } from './i18n.service';

// docs/specs/2026-08-28-16-internationalization.md §3 (aspect A-021). Reuses the 'settings'
// AdminModule permission — language/translation management is a platform-settings concern, same
// split-controller pattern as SettingsController/PublicSettingsController.
@ApiTags('admin/settings')
@ApiBearerAuth()
@Controller('api/admin/settings')
@Roles('admin', 'freelancer', 'moderator')
export class I18nAdminController {
  constructor(private readonly service: I18nService) {}

  @Get('languages')
  @RequiresPermission('settings', 'read_only')
  listLanguages(@Query('include_disabled') includeDisabled?: string) {
    return this.service.listLanguages(includeDisabled === 'true');
  }

  @Put('languages/:code')
  @RequiresPermission('settings', 'crud')
  upsertLanguage(@Param('code') code: string, @Body() dto: UpsertLanguageDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.upsertLanguage(code, dto, admin);
  }

  @Get('translations/:locale')
  @RequiresPermission('settings', 'read_only')
  getTranslations(@Param('locale') locale: string) {
    return this.service.getTranslationBundle(locale);
  }

  @Put('translations/:locale')
  @RequiresPermission('settings', 'crud')
  upsertTranslations(@Param('locale') locale: string, @Body() dto: UpsertTranslationsDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.upsertTranslations(locale, dto, admin);
  }
}
