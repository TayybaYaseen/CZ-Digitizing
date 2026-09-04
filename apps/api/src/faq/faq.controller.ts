import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { FaqQueryDto } from './dto/faq-query.dto';
import { CreateFaqDto, FaqFeedbackDto, UpdateFaqDto } from './dto/faq-write.dto';
import { FaqService } from './faq.service';

@ApiTags('faqs')
@Controller('api/faqs')
export class FaqController {
  constructor(private readonly service: FaqService) {}

  @Get()
  @Public()
  list(@Query() query: FaqQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.list(query, !publishedOnlyFor(req));
  }

  @Get('search')
  @Public()
  search(@Query('q') q: string, @Query('language_code') languageCode: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.service.search(q ?? '', languageCode, !publishedOnlyFor(req));
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, !publishedOnlyFor(req));
  }

  @Post(':id/feedback')
  @Public()
  @HttpCode(204)
  async feedback(@Param('id') id: string, @Body() dto: FaqFeedbackDto) {
    await this.service.feedback(id, dto.vote);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('faqs', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateFaqDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('faqs', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateFaqDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('faqs', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
