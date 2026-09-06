import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateHomeSectionDto, ReorderHomeSectionsDto, UpdateHomeSectionDto } from './dto/home-section-write.dto';
import { HomeSectionsService } from './home-sections.service';

@ApiTags('home')
@Controller()
export class HomeSectionsController {
  constructor(private readonly service: HomeSectionsService) {}

  @Get('api/home/sections')
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(!publishedOnlyFor(req));
  }

  @Post('api/admin/home/sections')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('home_sections', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateHomeSectionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put('api/admin/home/sections/reorder')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('home_sections', 'crud')
  @HttpCode(204)
  async reorder(@Body() dto: ReorderHomeSectionsDto, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.reorder(dto, admin);
  }

  @Put('api/admin/home/sections/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('home_sections', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateHomeSectionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete('api/admin/home/sections/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('home_sections', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
