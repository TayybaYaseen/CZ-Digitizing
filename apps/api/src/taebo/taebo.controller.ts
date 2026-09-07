import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TaeboChatDto } from './dto/taebo-chat.dto';
import { TaeboService } from './taebo.service';

// docs/specs/2026-08-28-15-taebo-chatbot.md §3 — public/opportunistically-authenticated routes.
// /chat works for both guests (customerId undefined) and logged-in customers, per AC-1/AC-6.
@ApiTags('taebo')
@Controller('api/taebo')
export class TaeboController {
  constructor(private readonly service: TaeboService) {}

  @Post('chat')
  @Public()
  chat(@Body() dto: TaeboChatDto, @Req() req: AuthenticatedRequest) {
    const customerId = req.user?.role === 'customer' ? req.user.sub : undefined;
    return this.service.chat(dto, customerId);
  }

  @Get('suggestions')
  @Public()
  suggestions(@Query('page') page: string | undefined, @Query('language_code') languageCode: string | undefined) {
    return this.service.suggestions(page, languageCode);
  }
}
