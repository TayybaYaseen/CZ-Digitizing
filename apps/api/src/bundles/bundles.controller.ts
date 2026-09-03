import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { publishedOnlyFor } from '../designs/staff-visibility.util';
import { BundlesService } from './bundles.service';
import { BundleQueryDto } from './dto/bundle-query.dto';
import { AddBundleDesignDto, CreateBundleDto, UpdateBundleDto } from './dto/bundle-write.dto';

// docs/specs/2026-08-28-06-design-bundles.md §3 (aspect A-008).
@ApiTags('bundles')
@Controller('api/bundles')
export class BundlesController {
  constructor(private readonly service: BundlesService) {}

  @Get()
  @Public()
  async list(@Query() query: BundleQueryDto, @Req() req: AuthenticatedRequest) {
    const { items, total } = await this.service.list(query, !publishedOnlyFor(req));
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, !publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateBundleDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateBundleDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }

  @Post(':id/designs/:designId')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  addDesign(@Param('id') id: string, @Param('designId') designId: string, @Body() dto: AddBundleDesignDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.addDesign(id, designId, dto, admin);
  }

  @Delete(':id/designs/:designId')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  @HttpCode(204)
  async removeDesign(@Param('id') id: string, @Param('designId') designId: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.removeDesign(id, designId, admin);
  }
}
