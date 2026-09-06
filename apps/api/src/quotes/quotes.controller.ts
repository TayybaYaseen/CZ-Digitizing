import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { ConvertQuoteDto, CreateQuoteDraftDto, CreateQuoteMessageDto, QuoteQueryDto, RespondQuoteDto, UpdateQuoteDraftDto } from './dto/quote-write.dto';
import type { QuoteAccess } from './quotes.service';
import { QuotesService } from './quotes.service';
import { OrdersService } from '../orders/orders.service';

const STAFF_ROLES = new Set(['admin', 'freelancer', 'moderator']);

// docs/specs/2026-08-28-11-smart-get-a-quote.md §3 — public draft/submit/chat (optionally
// authenticated), admin-only respond/suggest-price/convert/list.
@ApiTags('quotes')
@Controller('api/quotes')
export class QuotesController {
  constructor(
    private readonly service: QuotesService,
    private readonly orders: OrdersService,
  ) {}

  private access(req: AuthenticatedRequest, accessToken?: string): QuoteAccess {
    return { isStaff: !!req.user && STAFF_ROLES.has(req.user.role), customerId: req.user?.sub, accessToken };
  }

  @Post('draft')
  @Public()
  @HttpCode(201)
  createDraft(@Body() dto: CreateQuoteDraftDto, @Req() req: AuthenticatedRequest) {
    return this.service.createDraft(dto, req.user?.sub);
  }

  @Patch(':id')
  @Public()
  updateDraft(@Param('id') id: string, @Body() dto: UpdateQuoteDraftDto, @Headers('x-quote-access-token') token: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.service.updateDraft(id, dto, this.access(req, token));
  }

  @Post(':id/submit')
  @Public()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  submit(@Param('id') id: string, @Headers('x-quote-access-token') token: string | undefined, @Req() req: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    return this.service.submit(id, this.access(req, token), file);
  }

  @Get('user/history')
  @ApiBearerAuth()
  @Roles('customer')
  history(@CurrentUser() user: AccessTokenPayload) {
    return this.service.listForCustomer(user.sub);
  }

  @Get()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'read_only')
  list(@Query() query: QuoteQueryDto) {
    return this.service.listForAdmin(query);
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @Headers('x-quote-access-token') token: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, this.access(req, token));
  }

  @Get(':id/messages')
  @Public()
  listMessages(@Param('id') id: string, @Headers('x-quote-access-token') token: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.service.listMessages(id, this.access(req, token));
  }

  @Post(':id/messages')
  @Public()
  @HttpCode(201)
  addMessage(@Param('id') id: string, @Body() dto: CreateQuoteMessageDto, @Headers('x-quote-access-token') token: string | undefined, @Req() req: AuthenticatedRequest) {
    const access = this.access(req, token);
    const senderRole = access.isStaff ? 'admin' : 'customer';
    return this.service.addMessage(id, dto, access, senderRole);
  }

  @Post(':id/suggest-price')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  suggestPrice(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.suggestPrice(id, admin);
  }

  @Post(':id/respond')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  respond(@Param('id') id: string, @Body() dto: RespondQuoteDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.respond(id, dto, admin);
  }

  @Post(':id/convert')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('quotes', 'crud')
  convert(@Param('id') id: string, @Body() dto: ConvertQuoteDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.orders.createFromQuote(id, dto.paymentMethod, admin);
  }
}
