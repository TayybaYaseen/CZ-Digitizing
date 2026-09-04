import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { TipQueryDto } from './dto/tip-query.dto';
import { CreateTipDto, UpdateTipDto } from './dto/tip-write.dto';
import { TipsService } from './tips.service';

@ApiTags('tips')
@Controller('api/tips')
export class TipsController {
  constructor(private readonly service: TipsService) {}

  @Get()
  @Public()
  async list(@Query() query: TipQueryDto, @Req() req: AuthenticatedRequest) {
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
  @RequiresPermission('tips', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateTipDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('tips', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateTipDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('tips', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
