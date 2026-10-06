import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AccessTokenPayload } from '../auth/token.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { parseIdOr404 } from '../common/parse-id.util';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { SendSupportMessageDto, SupportAdminListQueryDto, SupportMessagesQueryDto, SupportReadDto, UpdateSupportStatusDto } from './dto/support-chat-write.dto';
import { SupportChatService } from './support-chat.service';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §10.2 — Admin → Customer Support → Live Chat.
// role=admin passes every route; freelancer/moderator need the support_chat module (read_only to
// read, crud to reply or change status) — enforced by the global AdminPermissionsGuard.
@ApiTags('admin/support-chat')
@ApiBearerAuth()
@Controller('api/admin/support')
@Roles('admin', 'freelancer', 'moderator')
export class SupportChatAdminController {
  constructor(private readonly service: SupportChatService) {}

  @Get('conversations')
  @RequiresPermission('support_chat', 'read_only')
  async list(@Query() query: SupportAdminListQueryDto) {
    const { items, total } = await this.service.listForAdmin(query);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('unread-count')
  @RequiresPermission('support_chat', 'read_only')
  async unreadCount() {
    return { conversations: await this.service.adminUnreadConversations() };
  }

  @Get('conversations/:id')
  @RequiresPermission('support_chat', 'read_only')
  get(@Param('id') id: string) {
    return this.service.getForAdmin(parseIdOr404(id, 'Conversation'));
  }

  @Get('conversations/:id/messages')
  @RequiresPermission('support_chat', 'read_only')
  async messages(@Param('id') id: string, @Query() query: SupportMessagesQueryDto) {
    const { items, hasMore } = await this.service.listMessagesForAdmin(parseIdOr404(id, 'Conversation'), query);
    return { data: items, meta: { hasMore } };
  }

  @Post('conversations/:id/messages')
  @RequiresPermission('support_chat', 'crud')
  @RateLimit(60, 60)
  async send(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { message, duplicate } = await this.service.sendAsAdmin(admin, parseIdOr404(id, 'Conversation'), dto);
    res.status(duplicate ? 200 : 201);
    return message;
  }

  @Post('conversations/:id/read')
  @RequiresPermission('support_chat', 'read_only')
  @HttpCode(200)
  read(@CurrentUser() admin: AccessTokenPayload, @Param('id') id: string, @Body() dto: SupportReadDto) {
    return this.service.markReadByAdmin(admin, parseIdOr404(id, 'Conversation'), BigInt(dto.upToMessageId));
  }

  @Patch('conversations/:id/status')
  @RequiresPermission('support_chat', 'crud')
  status(@CurrentUser() admin: AccessTokenPayload, @Param('id') id: string, @Body() dto: UpdateSupportStatusDto, @Req() req: Request) {
    return this.service.changeStatus(admin, parseIdOr404(id, 'Conversation'), dto.status, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
