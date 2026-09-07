import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { TaeboAnswerDto } from './dto/taebo-chat.dto';
import { TaeboWaitingQueryDto } from './dto/taebo-waiting-query.dto';
import { TaeboService } from './taebo.service';

// docs/specs/2026-08-28-15-taebo-chatbot.md §3 — AC-3/AC-5 admin escalation queue.
@ApiTags('admin/taebo')
@ApiBearerAuth()
@Controller('api/taebo')
@Roles('admin', 'freelancer', 'moderator')
export class TaeboAdminController {
  constructor(private readonly service: TaeboService) {}

  @Get('unanswered')
  @RequiresPermission('taebo', 'read_only')
  async unanswered(@Query() query: TaeboWaitingQueryDto) {
    const { items, total } = await this.service.listWaiting({ ...query, status: query.status ?? 'waiting' });
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Post('unanswered/:id/answer')
  @RequiresPermission('taebo', 'crud')
  answer(@Param('id') id: string, @Body() dto: TaeboAnswerDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.answer(id, dto, admin);
  }

  @Post('unanswered/:id/save-as-faq')
  @RequiresPermission('taebo', 'crud')
  saveAsFaq(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.saveAsFaq(id, admin);
  }
}
