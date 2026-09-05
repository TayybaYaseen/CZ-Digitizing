import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { AboutService } from './about.service';
import { UpsertAboutContentDto } from './dto/about-write.dto';

@ApiTags('about')
@Controller()
export class AboutController {
  constructor(private readonly service: AboutService) {}

  @Get('api/about')
  @Public()
  get(@Query('language_code') languageCode?: string) {
    return this.service.get(languageCode);
  }

  @Put('api/admin/about')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('about', 'crud')
  upsert(@Body() dto: UpsertAboutContentDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.upsert(dto, admin);
  }
}
