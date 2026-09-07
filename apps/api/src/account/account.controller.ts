import { Body, Controller, Delete, Get, HttpCode, Param, Put, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CurrencyQueryDto } from '../orders/dto/order-write.dto';
import { OrdersService } from '../orders/orders.service';
import { QuotesService } from '../quotes/quotes.service';
import { CustomRequestsService } from '../custom-requests/custom-requests.service';
import { AccountService } from './account.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019). Aggregation layer only —
// the orders/quotes/custom-requests reads below delegate straight to each owning feature's own
// service, unchanged, rather than re-implementing their query logic here.
@ApiTags('account')
@ApiBearerAuth()
@Controller('api/users')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly orders: OrdersService,
    private readonly quotes: QuotesService,
    private readonly customRequests: CustomRequestsService,
  ) {}

  @Get('profile')
  @Roles('customer')
  getProfile(@CurrentUser() user: AccessTokenPayload) {
    return this.account.getProfile(BigInt(user.sub));
  }

  @Put('profile')
  @Roles('customer')
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AccessTokenPayload) {
    return this.account.updateProfile(BigInt(user.sub), dto);
  }

  @Post('avatar')
  @Roles('customer')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AccessTokenPayload) {
    return this.account.updateAvatar(BigInt(user.sub), file);
  }

  // AC-1/AC-7 — delegates to OrdersService.listHistory(), the same method OrdersController's own
  // `GET /api/orders/user/history` already calls; this route is the account-area alias the spec
  // names, not a second implementation. `resolveEffectiveCustomerId` makes this (and every other
  // read below) resolve to the primary account's history for an invited secondary member, per AC-7.
  @Get('orders')
  @Roles('customer')
  async listOrders(@Query() query: CurrencyQueryDto, @CurrentUser() user: AccessTokenPayload) {
    const customerId = await this.account.resolveEffectiveCustomerId(BigInt(user.sub));
    const { items, total } = await this.orders.listHistory(customerId, query.page, query.pageSize, query.currencyCode);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('quotes')
  @Roles('customer')
  async listQuotes(@CurrentUser() user: AccessTokenPayload) {
    const customerId = await this.account.resolveEffectiveCustomerId(BigInt(user.sub));
    return { data: await this.quotes.listForCustomer(customerId.toString()) };
  }

  @Get('custom-requests')
  @Roles('customer')
  async listCustomRequests(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @CurrentUser() user: AccessTokenPayload) {
    const customerId = await this.account.resolveEffectiveCustomerId(BigInt(user.sub));
    const { items, total } = await this.customRequests.listForCustomer(customerId.toString(), Number(page), Number(pageSize));
    return { data: items, meta: { page: Number(page), pageSize: Number(pageSize), total } };
  }

  @Get('purchased-designs')
  @Roles('customer')
  async listPurchasedDesigns(@CurrentUser() user: AccessTokenPayload) {
    const customerId = await this.account.resolveEffectiveCustomerId(BigInt(user.sub));
    return { data: await this.account.listPurchasedDesigns(customerId) };
  }

  // AC-7 — primary-account-only member management. See account.service.ts's resolveEffectiveCustomerId
  // doc comment for why this is the minimal-viable reading of AC-7 (invitee must already have their
  // own registered login), not a full invite-by-email-to-a-new-signup flow.
  @Post('account-members')
  @Roles('customer')
  @HttpCode(201)
  inviteMember(@Body() dto: InviteMemberDto, @CurrentUser() user: AccessTokenPayload) {
    return this.account.inviteMember(BigInt(user.sub), dto.email);
  }

  @Get('account-members')
  @Roles('customer')
  async listMembers(@CurrentUser() user: AccessTokenPayload) {
    return { data: await this.account.listMembers(BigInt(user.sub)) };
  }

  @Delete('account-members/:id')
  @Roles('customer')
  @HttpCode(204)
  revokeMember(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.account.revokeMember(BigInt(user.sub), BigInt(id));
  }
}
