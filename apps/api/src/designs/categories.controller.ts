import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, CreateSubcategoryDto, UpdateCategoryDto, UpdateSubcategoryDto } from './dto/category.dto';
import { publishedOnlyFor } from './staff-visibility.util';

// docs/specs/2026-08-28-04-design-catalog-browsing.md §3 — public GETs (customer browsing),
// admin-only writes (AC-1). Uses the 'categories' AdminModule already in the permission enum.
@ApiTags('categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.listCategories(publishedOnlyFor(req));
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string) {
    return this.service.getCategory(id);
  }

  @Get(':id/subcategories')
  @Public()
  listSubcategories(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.listSubcategories(id, publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateCategoryDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.createCategory(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateCategory(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.deleteCategory(id, admin);
  }

  @Post(':id/subcategories')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  @HttpCode(201)
  createSubcategory(@Param('id') id: string, @Body() dto: CreateSubcategoryDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.createSubcategory(id, dto, admin);
  }
}

// Admin write/read routes for a single subcategory by its own id — kept separate from
// CategoriesController's :id param space (which is a category id) to avoid route collisions.
@ApiTags('categories')
@Controller('api/subcategories')
export class SubcategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.listAllSubcategories(publishedOnlyFor(req));
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateSubcategoryDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updateSubcategory(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('categories', 'crud')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.deleteSubcategory(id, admin);
  }
}
