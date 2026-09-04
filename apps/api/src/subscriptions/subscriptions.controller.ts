import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { ChangePlanDto, SubscribeDto } from './dto/subscription-write.dto';
import { SubscriptionsService } from './subscriptions.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3 (aspect A-015a) — public + customer routes.
@ApiTags('subscriptions')
@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('plans')
  @Public()
  plans() {
    return this.service.listPublicPlans();
  }

  @Post('subscribe')
  @Roles('customer')
  @ApiBearerAuth()
  @HttpCode(201)
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.subscribe(BigInt(user.sub), dto.planId, dto.paymentMethod);
  }

  @Get('current')
  @Roles('customer')
  @ApiBearerAuth()
  current(@CurrentUser() user: AccessTokenPayload) {
    return this.service.getCurrent(BigInt(user.sub));
  }

  @Put('cancel')
  @Roles('customer')
  @ApiBearerAuth()
  cancel(@CurrentUser() user: AccessTokenPayload) {
    return this.service.cancel(BigInt(user.sub));
  }

  // AC-9 — not in the spec's own API contract table (only in the acceptance criteria), added as
  // the natural customer-facing route, same posture as CreditsController's gift route.
  @Put('change-plan')
  @Roles('customer')
  @ApiBearerAuth()
  changePlan(@Body() dto: ChangePlanDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.changePlan(BigInt(user.sub), dto);
  }

  // Consumes one logo/design-file download from the customer's active subscription allotment.
  // Not in the spec's own contract table (added alongside AC-9's change-plan for the same reason —
  // the natural customer-facing route for a capability the acceptance criteria imply but the
  // contract table predates). Called by the frontend's design-download flow before/alongside the
  // actual file download when the customer has an active subscription with a logo allowance.
  @Post('logos/consume')
  @Roles('customer')
  @ApiBearerAuth()
  @HttpCode(200)
  consumeLogo(@CurrentUser() user: AccessTokenPayload) {
    return this.service.consumeLogoDownload(BigInt(user.sub));
  }
}
