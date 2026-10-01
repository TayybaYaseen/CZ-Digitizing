import { Controller, Get, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { ApiException } from '../common/exceptions/api-exception';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { CustomerFilesService } from '../files/customer-files.service';
import { readGuestAccessKeyHash } from './guest-access-key.util';
import { OrdersService } from './orders.service';

// Guest checkout — a guest browser's view of the orders it placed without signing in (created by
// POST /api/cart/guest-checkout). @Public() because there is no account session; what authorizes
// every route is the browser's httpOnly czd_guest_orders cookie, whose SHA-256 must match the
// order's guestAccessKeyHash in the SAME query as the order id (see OrdersService.findGuestOwned and
// CustomerFilesService.guestOwner). The order id alone, the email, name or WhatsApp number never
// grant anything: without the matching key every route answers 404 / an empty list.
//
// The routes mirror the signed-in ones one-for-one (GET /api/orders/:id, POST /api/orders/:id/receipt,
// GET/POST /api/orders/:id/files...) and call the same service code, so a guest gets exactly the
// payment gate (files only at 100% paid + admin-confirmed, re-locked by any refund), receipt checks,
// .EMB exclusion and download-attempt limits a customer gets — no more, no less.
@ApiTags('guest-orders')
@Controller('api/guest-orders')
@Public()
export class GuestOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly files: CustomerFilesService,
  ) {}

  // The home page's guest order cards. No cookie (a visitor who never bought) is an empty list, not
  // an error, so the home page simply shows nothing.
  @Get()
  list(@Req() req: Request) {
    return this.orders.listForGuest(readGuestAccessKeyHash(req));
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: Request) {
    return this.orders.getForGuest(id, readGuestAccessKeyHash(req));
  }

  @Post(':id/receipt')
  @RateLimit(10, 60)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @HttpCode(201)
  uploadReceipt(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new ApiException('RECEIPT_REQUIRED', 422, 'A receipt file is required');
    return this.orders.uploadReceiptForGuest(id, readGuestAccessKeyHash(req), file);
  }

  @Get(':id/files')
  listFiles(@Param('id') id: string, @Req() req: Request) {
    return this.files.listAuthorizedFilesForGuest(id, readGuestAccessKeyHash(req));
  }

  @Post(':id/files/:fileId/download')
  @RateLimit(30, 60)
  @HttpCode(200)
  download(@Param('id') id: string, @Param('fileId') fileId: string, @Req() req: Request) {
    return this.files.requestDownloadForGuest(id, fileId, readGuestAccessKeyHash(req));
  }
}
