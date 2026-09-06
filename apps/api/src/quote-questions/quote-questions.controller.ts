import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { publishedOnlyFor } from '../common/staff-visibility.util';
import type { AccessTokenPayload } from '../auth/token.types';
import { QuoteQuestionQueryDto } from './dto/quote-question-query.dto';
import { CreateQuoteQuestionDto, UpdateQuoteQuestionDto } from './dto/quote-question-write.dto';
import { QuoteQuestionsService } from './quote-questions.service';

// docs/specs/2026-08-28-11-smart-get-a-quote.md §3 — public GET (Step 2), admin-only writes (AC-5).
@ApiTags('quote-questions')
@Controller('api/quote-questions')
export class QuoteQuestionsController {
  constructor(private readonly service: QuoteQuestionsService) {}

  @Get()
  @Public()
  list(@Query() query: QuoteQuestionQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.list(query, !publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateQuoteQuestionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteQuestionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
