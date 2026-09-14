import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { OrdersService } from '../orders/orders.service';
import { CustomRequestFilesService } from './custom-request-files.service';
import { CustomRequestProductionService } from './custom-request-production.service';
import { CustomRequestsService } from './custom-requests.service';
import {
  ApproveQuoteDto,
  CreateCustomRequestDto,
  CreateCustomRequestMessageDto,
  CreateCustomRequestProductionFileDto,
  CreateCustomRequestTaskDto,
  CreateCustomRequestTimeEntryDto,
  CustomRequestQueryDto,
  SendQuoteDto,
  UpdateCustomRequestDto,
  UpdateCustomRequestTaskDto,
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
    private readonly production: CustomRequestProductionService,
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

  // AC-9 — designer production tooling. Staff-only (no customer-facing route exists for any of
  // these); see CustomRequestProductionService's own file-level comment for why this internal
  // tooling has no payment/status gate the way AC-5's customer deliverable does.

  @Get(':id/tasks')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'read_only')
  listTasks(@Param('id') id: string) {
    return this.production.listTasks(id);
  }

  @Post(':id/tasks')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @HttpCode(201)
  createTask(@Param('id') id: string, @Body() dto: CreateCustomRequestTaskDto, @CurrentUser() staff: AccessTokenPayload) {
    return this.production.createTask(id, dto, staff);
  }

  @Put(':id/tasks/:taskId')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  updateTask(@Param('id') id: string, @Param('taskId') taskId: string, @Body() dto: UpdateCustomRequestTaskDto) {
    return this.production.updateTask(id, taskId, dto);
  }

  @Delete(':id/tasks/:taskId')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @HttpCode(204)
  async deleteTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    await this.production.deleteTask(id, taskId);
  }

  @Get(':id/time-entries')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'read_only')
  listTimeEntries(@Param('id') id: string) {
    return this.production.listTimeEntries(id);
  }

  @Post(':id/time-entries')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @HttpCode(201)
  logTime(@Param('id') id: string, @Body() dto: CreateCustomRequestTimeEntryDto, @CurrentUser() staff: AccessTokenPayload) {
    return this.production.logTime(id, dto, staff);
  }

  @Delete(':id/time-entries/:entryId')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @HttpCode(204)
  async deleteTimeEntry(@Param('id') id: string, @Param('entryId') entryId: string) {
    await this.production.deleteTimeEntry(id, entryId);
  }

  @Get(':id/production-files')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'read_only')
  listProductionFiles(@Param('id') id: string) {
    return this.production.listProductionFiles(id);
  }

  @Post(':id/production-files')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'crud')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: UPLOAD_LIMITS }))
  uploadProductionFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateCustomRequestProductionFileDto,
    @CurrentUser() staff: AccessTokenPayload,
  ) {
    return this.production.uploadProductionFile(id, file, dto, staff);
  }

  // Streams the bytes directly — staff-only, already role/permission-gated above, so this doesn't
  // need AC-5's customer-facing signed-token indirection (see CustomRequestProductionService).
  // Uses bare @Res() (not passthrough) rather than returning a StreamableFile: the app's global
  // ResponseInterceptor unconditionally wraps every controller return value in a `{ data }`
  // envelope, which would corrupt a StreamableFile's bytes. Bare @Res() opts this one route out of
  // Nest's automatic response handling (and therefore that interceptor's transform) entirely, the
  // documented way to serve raw bytes alongside a global envelope interceptor.
  @Get(':id/production-files/:fileId/download')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('custom_requests', 'read_only')
  async downloadProductionFile(@Param('id') id: string, @Param('fileId') fileId: string, @Res() res: Response) {
    const { buffer, fileFormat, version } = await this.production.readProductionFileForDownload(id, fileId);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="custom-request-${id}-v${version}.${fileFormat}"`,
    });
    res.send(buffer);
  }
}
