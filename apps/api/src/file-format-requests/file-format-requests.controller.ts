import { Body, Controller, Get, HttpCode, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateFileFormatRequestDto, FulfillFileFormatRequestDto } from './dto/file-format-request-write.dto';
import { FileFormatRequestsService } from './file-format-requests.service';

// docs/specs/2026-08-28-12-custom-design-requests.md §3 (aspect A-017a) — "Need Another File
// Format?" on an already-purchased order.
@ApiTags('file-format-requests')
@ApiBearerAuth()
@Controller('api')
export class FileFormatRequestsController {
  constructor(private readonly service: FileFormatRequestsService) {}

  @Post('orders/:orderId/file-format-request')
  @Roles('customer')
  @HttpCode(201)
  create(@Param('orderId') orderId: string, @Body() dto: CreateFileFormatRequestDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.create(orderId, BigInt(user.sub), dto);
  }

  // Owner-or-admin — same posture as OrdersController.get().
  @Get('orders/:orderId/file-format-requests')
  @Roles('customer', 'admin', 'freelancer', 'moderator')
  listForOrder(@Param('orderId') orderId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.service.listForOrder(orderId, user.role === 'customer' ? BigInt(user.sub) : undefined);
  }

  @Get('file-format-requests')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'read_only')
  list() {
    return this.service.listForAdmin();
  }

  @Post('file-format-requests/:id/fulfill')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'crud')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  fulfill(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: FulfillFileFormatRequestDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.fulfill(id, file, dto, admin);
  }
}
