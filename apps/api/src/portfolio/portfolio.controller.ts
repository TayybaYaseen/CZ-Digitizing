import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreatePortfolioItemDto, ReorderPortfolioDto, UpdatePortfolioItemDto } from './dto/portfolio-write.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller('api/portfolio')
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Get()
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(!publishedOnlyFor(req));
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, !publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('portfolio', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreatePortfolioItemDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put('reorder')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('portfolio', 'crud')
  @HttpCode(204)
  async reorder(@Body() dto: ReorderPortfolioDto, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.reorder(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('portfolio', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdatePortfolioItemDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('portfolio', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
