import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { OrdersService } from '../orders/orders.service';
import { CustomRequestFilesService } from './custom-request-files.service';
import { CustomRequestsService } from './custom-requests.service';
import {
  ApproveQuoteDto,
  CreateCustomRequestDto,
  CreateCustomRequestMessageDto,
  CustomRequestQueryDto,
  SendQuoteDto,
  UpdateCustomRequestDto,
} from './dto/custom-request-write.dto';

const UPLOAD_LIMITS = { fileSize: 10 * 1024 * 1024 };
const STAFF_ROLES = new Set(['admin', 'freelancer', 'moderator']);

// docs/specs/2026-08-28-12-custom-design-requests.md §3 (aspect A-017). customer_id is NOT NULL in
// the architecture DDL (unlike Quote's guest posture), so submission requires an authenticated
// customer rather than the spec table's "Public/authenticated customer" — the DDL wins per
// docs/CLAUDE.md's Aspect-File-is-authoritative rule for data-model conflicts.
@ApiTags('custom-requests')
@ApiBearerAuth()
@Controller('api/custom-requests')
export class CustomRequestsController {
  constructor(
    private readonly service: CustomRequestsService,
    private readonly files: CustomRequestFilesService,
    private readonly orders: OrdersService,
  ) {}

  @Post()
  @Roles('customer')
  @HttpCode(201)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'references', maxCount: 10 }], { storage: memoryStorage(), limits: UPLOAD_LIMITS }))
  create(
    @Body() dto: CreateCustomRequestDto,
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFiles() files?: { image?: Express.Multer.File[]; references?: Express.Multer.File[] },
  ) {
    return this.service.create(dto, user.sub, files?.image?.[0], files?.references ?? []);
  }

  @Post(':id/references')
  @Roles('customer')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: UPLOAD_LIMITS }))
  addReference(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AccessTokenPayload) {
    return this.service.addReferences(id, user.sub, file ? [file] : []);
  }

  @Get('user/history')
  @Roles('customer')
  history(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @CurrentUser() user: AccessTokenPayload) {
    return this.service.listForCustomer(user.sub, Number(page), Number(pageSize)).then(({ items, total }) => ({
      data: items,
      meta: { page: Number(page), pageSize: Number(pageSize), total },
    }));
  }

  @Get()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'read_only')
  async list(@Query() query: CustomRequestQueryDto) {
    const { items, total } = await this.service.listForAdmin(query);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  // Owner-or-admin — same posture as OrdersController.get().
  @Get(':id')
  @Roles('customer', 'admin', 'freelancer', 'moderator')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (req.user.role === 'customer') return this.service.getForCustomer(id, req.user.sub);
    return this.service.getForAdmin(id);
  }

  @Put(':id')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateCustomRequestDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Post(':id/quote')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  sendQuote(@Param('id') id: string, @Body() dto: SendQuoteDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.sendQuote(id, dto, admin);
  }

  // AC-4 — customer accepts the quote; creates the linked Order (OrdersService.createFromCustomRequest).
  @Post(':id/approve')
  @Roles('customer')
  approve(@Param('id') id: string, @Body() dto: ApproveQuoteDto, @CurrentUser() user: AccessTokenPayload) {
    return this.orders.createFromCustomRequest(id, BigInt(user.sub), dto.paymentMethod);
  }

  @Get(':id/messages')
  @Roles('customer', 'admin', 'freelancer', 'moderator')
  listMessages(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.listMessages(id, req.user.sub, STAFF_ROLES.has(req.user.role));
  }

  @Post(':id/messages')
  @Roles('customer', 'admin', 'freelancer', 'moderator')
  @HttpCode(201)
  addMessage(@Param('id') id: string, @Body() dto: CreateCustomRequestMessageDto, @Req() req: AuthenticatedRequest) {
    return this.service.addMessage(id, dto, req.user.sub, STAFF_ROLES.has(req.user.role));
  }

  // AC-5 — admin delivers final production files, routed through the private-file pipeline.
  @Post(':id/files')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: UPLOAD_LIMITS }))
  deliverFiles(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() admin: AccessTokenPayload) {
    return this.files.deliver(id, file, admin);
  }

  @Post(':id/files/:fileId/download')
  @Roles('customer')
  @HttpCode(200)
  downloadFile(@Param('id') id: string, @Param('fileId') fileId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.files.requestDownload(id, fileId, BigInt(user.sub));
  }
}
