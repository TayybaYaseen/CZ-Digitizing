import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateHeaderMediaDto, HeaderMediaQueryDto, UpdateHeaderMediaDto } from './dto/header-media-write.dto';
import { HeaderMediaService } from './header-media.service';

@ApiTags('home')
@Controller()
export class HeaderMediaController {
  constructor(private readonly service: HeaderMediaService) {}

  @Get('api/home/header-media')
  @Public()
  listActive(@Query() query: HeaderMediaQueryDto) {
    return this.service.listActive(query.platform);
  }

  @Get('api/admin/header-media')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('header_media', 'read_only')
  listAdmin() {
    return this.service.listAdmin();
  }

  @Post('api/admin/header-media')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('header_media', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateHeaderMediaDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put('api/admin/header-media/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('header_media', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateHeaderMediaDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete('api/admin/header-media/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('header_media', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
