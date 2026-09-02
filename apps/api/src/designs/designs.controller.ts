import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { DesignQueryDto } from './dto/design-query.dto';
import { CreateDesignDto, UpdateDesignDto } from './dto/design-write.dto';
import { DesignsService } from './designs.service';
import { publishedOnlyFor } from './staff-visibility.util';

// These GET routes read req.user when present (an authenticated customer's favorite status,
// AC-8) but don't require it — JwtAuthGuard leaves req.user undefined on an @Public() route with
// no/invalid bearer token rather than throwing.
function optionalCustomerId(req: Partial<AuthenticatedRequest>): bigint | undefined {
  return req.user && req.user.role === 'customer' ? BigInt(req.user.sub) : undefined;
}

@ApiTags('designs')
@Controller('api/designs')
export class DesignsController {
  constructor(private readonly service: DesignsService) {}

  @Get()
  @Public()
  async list(@Query() query: DesignQueryDto, @Req() req: AuthenticatedRequest) {
    const { items, total } = await this.service.list(query, optionalCustomerId(req), !publishedOnlyFor(req));
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('search')
  @Public()
  search(@Query('q') q: string, @Req() req: AuthenticatedRequest) {
    return this.service.search(q ?? '', optionalCustomerId(req));
  }

  @Get('category/:categoryId')
  @Public()
  async listByCategory(@Param('categoryId') categoryId: string, @Query() query: DesignQueryDto, @Req() req: AuthenticatedRequest) {
    const { items, total } = await this.service.listByCategory(categoryId, query, optionalCustomerId(req), !publishedOnlyFor(req));
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('subcategory/:subcategoryId')
  @Public()
  async listBySubcategory(@Param('subcategoryId') subcategoryId: string, @Query() query: DesignQueryDto, @Req() req: AuthenticatedRequest) {
    const { items, total } = await this.service.listBySubcategory(subcategoryId, query, optionalCustomerId(req), !publishedOnlyFor(req));
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, optionalCustomerId(req), !publishedOnlyFor(req));
  }

  @Get(':id/sizes')
  @Public()
  getSizes(@Param('id') id: string) {
    return this.service.getSizes(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('designs', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateDesignDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('designs', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateDesignDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('designs', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }

  @Post(':id/favorite')
  @ApiBearerAuth()
  @Roles('customer')
  @HttpCode(204)
  async favorite(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.service.favorite(id, BigInt(user.sub));
  }

  @Delete(':id/favorite')
  @ApiBearerAuth()
  @Roles('customer')
  @HttpCode(204)
  async unfavorite(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.service.unfavorite(id, BigInt(user.sub));
  }
}
