import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { RecordViewDto } from './dto/record-view.dto';

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019), AC-9/AC-13.
@ApiTags('activity')
@ApiBearerAuth()
@Controller('api')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('users/activity')
  @Roles('customer')
  async listMine(@Query() query: ActivityQueryDto, @CurrentUser() user: AccessTokenPayload) {
    const customerId = await this.activity.resolveEffectiveCustomerId(BigInt(user.sub));
    const { items, total } = await this.activity.listForCustomer(customerId, query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  // AC-9 — idempotent per (customerId, designId, sessionId). `device_id` (already established at
  // login, see token.types.ts) stands in for "session" here rather than inventing a second cookie
  // just for view-tracking — a page refresh or repeated internal re-render carries the same
  // device_id within one browser session, which is exactly the dedup boundary AC-9 asks for.
  @Post('designs/:id/view')
  @Roles('customer')
  @HttpCode(202)
  async recordView(@Param('id') designId: string, @Body() dto: RecordViewDto, @CurrentUser() user: AccessTokenPayload) {
    await this.activity.record({
      customerId: BigInt(user.sub),
      eventType: 'VIEWED',
      designId: BigInt(designId),
      source: dto.source ?? 'web',
      idempotencyKey: `${user.sub}:VIEWED:${designId}:${user.device_id}`,
    });
  }
}
