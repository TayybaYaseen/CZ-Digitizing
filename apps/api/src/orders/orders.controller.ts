import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import type { OrderStatus } from '../generated/prisma';
import { CurrencyQueryDto, OrderQueryDto, PaymentConfirmationDto, RefundOrderDto, UpdateOrderStatusDto } from './dto/order-write.dto';
import { OrdersService } from './orders.service';

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (aspect A-013). No standalone
// `POST /api/orders` route: the spec's own table notes it's "created from cart contents" (Cart
// spec AC-6), and CartController's existing `POST /api/cart/checkout` is that real trigger —
// adding a second, parallel order-creation entry point here would let a customer create an order
// from something other than their own validated cart, which is exactly what checkout's
// pre-validation (ITEM_NOT_PUBLISHED/SIZE_REQUIRED) exists to prevent. OrdersService.createFromCart
// is the internal method both this decision and CartService.checkout() rely on.
@ApiTags('orders')
@ApiBearerAuth()
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get('user/history')
  @Roles('customer')
  history(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @Query() query: CurrencyQueryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.listHistory(BigInt(user.sub), Number(page), Number(pageSize), query.currencyCode).then(({ items, total }) => ({
      data: items,
      meta: { page: Number(page), pageSize: Number(pageSize), total },
    }));
  }

  @Get()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'read_only')
  async list(@Query() query: OrderQueryDto) {
    const { items, total } = await this.service.listAdmin(query);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  // Owner-or-admin: unlike every other admin-gated route in this controller, this one is reachable
  // by role=customer too (see the guard order below) — @Roles() alone can't express "owner OR
  // admin", so this checks ownership inside the handler for a customer caller instead.
  @Get(':id')
  @Roles('customer', 'admin', 'freelancer', 'moderator')
  async get(@Param('id') id: string, @Query() query: CurrencyQueryDto, @Req() req: AuthenticatedRequest) {
    if (req.user.role === 'customer') return this.service.getForCustomer(id, BigInt(req.user.sub), query.currencyCode);
    return this.service.getForAdmin(id);
  }

  @Put(':id/status')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'crud')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto.status as OrderStatus);
  }

  @Post(':id/payment-confirmation')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'crud')
  confirmPayment(@Param('id') id: string, @Body() dto: PaymentConfirmationDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.reviewPaymentConfirmation(id, dto, admin);
  }

  @Put(':id/refund')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('orders', 'crud')
  refund(@Param('id') id: string, @Body() dto: RefundOrderDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.refund(id, dto, admin);
  }

  // spec §3 — "POST /api/orders/:id/receipt (new, proposed)". memoryStorage: hashed/validated
  // before ever touching disk, same posture as DesignFilesController's upload route.
  @Post(':id/receipt')
  @Roles('customer')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @HttpCode(201)
  uploadReceipt(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AccessTokenPayload) {
    if (!file) throw new ApiException('RECEIPT_REQUIRED', 422, 'A receipt file is required');
    return this.service.uploadReceipt(id, BigInt(user.sub), file);
  }
}
