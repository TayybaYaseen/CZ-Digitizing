import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../auth/token.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { parseIdOr404 } from '../common/parse-id.util';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { SendSupportMessageDto, StartSupportConversationDto, SupportCustomerListQueryDto, SupportMessagesQueryDto, SupportReadDto } from './dto/support-chat-write.dto';
import { SupportChatService } from './support-chat.service';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §10.1 — customer side of "Chat with Support".
// role=customer only: staff accounts can't create "customer" conversations with themselves (§12).
@ApiTags('support-chat')
@ApiBearerAuth()
@Controller('api/support')
@Roles('customer')
export class SupportChatController {
  constructor(private readonly service: SupportChatService) {}

  @Get('conversations')
  async list(@CurrentUser() user: AccessTokenPayload, @Query() query: SupportCustomerListQueryDto) {
    const { items, total } = await this.service.listForCustomer(user, query);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  // 201 when a conversation was created, 200 when the customer's active one was reused (§10.1).
  @Post('conversations')
  @RateLimit(10, 60 * 60)
  async start(@CurrentUser() user: AccessTokenPayload, @Body() dto: StartSupportConversationDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.start(user, dto);
    res.status(result.created ? 201 : 200);
    return result;
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AccessTokenPayload) {
    return { total: await this.service.customerUnreadTotal(user) };
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.service.getForCustomer(user, parseIdOr404(id, 'Conversation'));
  }

  @Get('conversations/:id/messages')
  async messages(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Query() query: SupportMessagesQueryDto) {
    const { items, hasMore } = await this.service.listMessagesForCustomer(user, parseIdOr404(id, 'Conversation'), query);
    return { data: items, meta: { hasMore } };
  }

  // Idempotent on clientMessageId: 201 for a new message, 200 for a replayed one (§11.6).
  @Post('conversations/:id/messages')
  @RateLimit(30, 60)
  async send(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { message, duplicate } = await this.service.sendAsCustomer(user, parseIdOr404(id, 'Conversation'), dto);
    res.status(duplicate ? 200 : 201);
    return message;
  }

  @Post('conversations/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string, @Body() dto: SupportReadDto) {
    return this.service.markReadByCustomer(user, parseIdOr404(id, 'Conversation'), BigInt(dto.upToMessageId));
  }
}
