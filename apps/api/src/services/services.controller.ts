import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateServiceDto, ReorderServiceDto, UpdateServiceDto } from './dto/service-write.dto';
import { ServicesService } from './services.service';

// docs/specs/2026-08-29-17-services-module.md §3 — public GETs (customer browsing + Get a Quote
// entry point), admin-only writes (AC-8).
@ApiTags('services')
@Controller('api/services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.listMainServices(publishedOnlyFor(req));
  }

  @Get(':slug')
  @Public()
  get(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.service.getBySlug(slug, publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('services', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateServiceDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('services', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('services', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }

  @Put(':id/reorder')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('services', 'crud')
  reorder(@Param('id') id: string, @Body() dto: ReorderServiceDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.reorder(id, dto, admin);
  }
}
