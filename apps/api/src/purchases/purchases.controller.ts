import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '../auth/token.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PurchaseCreditsDto } from '../credits/dto/credit-write.dto';
import { SubscribeDto } from '../subscriptions/dto/subscription-write.dto';
import { PurchasesService } from './purchases.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3 (POST /api/credits/purchase, POST
// /api/subscriptions/subscribe) — both respond with the bank-transfer OrderDto to pay
// ({ id, amountDuePkr, bankTransferReference, ... }); the customer is sent to
// /checkout/bank-transfer/:id to see the bank details and upload a receipt.
@ApiTags('purchases')
@ApiBearerAuth()
@Controller('api')
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Post('credits/purchase')
  @Roles('customer')
  @HttpCode(201)
  purchaseCredits(@Body() dto: PurchaseCreditsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.purchaseCredits(BigInt(user.sub), dto.packageId);
  }

  @Post('subscriptions/subscribe')
  @Roles('customer')
  @HttpCode(201)
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.subscribe(BigInt(user.sub), dto.planId);
  }
}
