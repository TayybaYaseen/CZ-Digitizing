import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { BlogQueryDto } from './dto/blog-query.dto';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-write.dto';
import { BlogService } from './blog.service';

@ApiTags('blog')
@Controller('api/blog')
export class BlogController {
  constructor(private readonly service: BlogService) {}

  @Get()
  @Public()
  async list(@Query() query: BlogQueryDto, @Req() req: AuthenticatedRequest) {
    const { items, total } = await this.service.list(query, !publishedOnlyFor(req));
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('search')
  @Public()
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Get(':slug')
  @Public()
  getBySlug(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.service.getBySlug(slug, !publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('blog', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateBlogPostDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('blog', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('blog', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
