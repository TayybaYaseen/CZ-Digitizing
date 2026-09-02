import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { UpdatePaymentMethodsDto } from './dto/update-payment-methods.dto';
import { UpdateSocialDto } from './dto/update-social.dto';
import { PlatformSettingsService } from './platform-settings.service';

// docs/specs/2026-08-28-03-admin-platform-settings.md §3. AC-7 — read is read_only, every write
// requires crud on the 'settings' module (freelancer/moderator scoping via AdminPermissionsGuard;
// role=admin always passes).
@ApiTags('admin/settings')
@ApiBearerAuth()
@Controller('api/admin/settings')
@Roles('admin', 'freelancer', 'moderator')
export class SettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get()
  @RequiresPermission('settings', 'read_only')
  get() {
    return this.service.get();
  }

  @Put('contact')
  @RequiresPermission('settings', 'crud')
  updateContact(@Body() dto: UpdateContactDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateContact(dto, admin);
  }

  @Put('social')
  @RequiresPermission('settings', 'crud')
  updateSocial(@Body() dto: UpdateSocialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateSocial(dto, admin);
  }

  @Put('experience')
  @RequiresPermission('settings', 'crud')
  updateExperience(@Body() dto: UpdateExperienceDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateExperience(dto, admin);
  }

  @Put('domain')
  @RequiresPermission('settings', 'crud')
  updateDomain(@Body() dto: UpdateDomainDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateDomain(dto, admin);
  }

  @Put('payment-methods')
  @RequiresPermission('settings', 'crud')
  updatePaymentMethods(@Body() dto: UpdatePaymentMethodsDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updatePaymentMethods(dto, admin);
  }
}

// AC-1/AC-3/AC-4 — the public, non-sensitive subset every public page reads (footer, Contact,
// WhatsApp click-to-chat, "years of experience"). Separate controller so @Public() never risks
// leaking onto an admin-only route by an accidental decorator placement.
@ApiTags('settings')
@Controller('api/settings')
export class PublicSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get('public')
  @Public()
  getPublic() {
    return this.service.getPublic();
  }
}
