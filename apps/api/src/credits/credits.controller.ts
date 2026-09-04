import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreditsService } from './credits.service';
import { GiftCreditsDto, PurchaseCreditsDto } from './dto/credit-write.dto';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3 (aspect A-015b) — public + customer routes.
@ApiTags('credits')
@Controller('api/credits')
export class CreditsController {
  constructor(private readonly service: CreditsService) {}

  @Get('packages')
  @Public()
  packages() {
    return this.service.listPublicPackages();
  }

  @Get('balance')
  @Roles('customer')
  @ApiBearerAuth()
  balance(@CurrentUser() user: AccessTokenPayload) {
    return this.service.getBalance(BigInt(user.sub));
  }

  @Get('transactions')
  @Roles('customer')
  @ApiBearerAuth()
  async transactions(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @CurrentUser() user: AccessTokenPayload) {
    const { items, total } = await this.service.listTransactions(BigInt(user.sub), Number(page), Number(pageSize));
    return { data: items, meta: { page: Number(page), pageSize: Number(pageSize), total } };
  }

  @Post('purchase')
  @Roles('customer')
  @ApiBearerAuth()
  @HttpCode(201)
  purchase(@Body() dto: PurchaseCreditsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.purchase(BigInt(user.sub), dto.packageId, dto.paymentMethod);
  }

  // AC-10 — not in the spec's own API contract table (only listed under §4's acceptance criteria),
  // added here as the natural customer-facing route for it, same posture as this repo's other
  // "table lists the common routes, a clearly-derived one is added alongside it" cases.
  @Post('gift')
  @Roles('customer')
  @ApiBearerAuth()
  @HttpCode(200)
  gift(@Body() dto: GiftCreditsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.gift(BigInt(user.sub), dto);
  }
}
