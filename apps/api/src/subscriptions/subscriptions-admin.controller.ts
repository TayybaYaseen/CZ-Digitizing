import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { SubscriptionPlanWriteDto } from './dto/subscription-write.dto';
import { SubscriptionsService } from './subscriptions.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3 — plan CRUD (role=admin, spec's contract
// table). Mounted at 'api/subscriptions/admin' rather than the spec table's literal
// '/plans'/'/plans/:id' under 'api/subscriptions': that literal reading collides with
// SubscriptionsController's own @Get('plans') @Public() at the exact same path/method, and since
// Nest/Express resolve duplicate-path routes by registration order, that collision silently routed
// every GET here (including from this admin CRUD page) to the *public*, published-only handler —
// meaning Admin could never see or manage a draft/unpublished plan, and the read_only/crud
// permission gate on this list was never actually enforced. Distinct base path removes the
// ambiguity outright; POST/PUT never collided (SubscriptionsController has no POST/PUT at this
// path), only the GET did.
@ApiTags('subscriptions-admin')
@ApiBearerAuth()
@Controller('api/subscriptions/admin')
export class SubscriptionsAdminController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('plans')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('subscriptions', 'read_only')
  list() {
    return this.service.listAdminPlans();
  }

  @Post('plans')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('subscriptions', 'crud')
  create(@Body() dto: SubscriptionPlanWriteDto) {
    return this.service.createPlan(dto);
  }

  @Put('plans/:id')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('subscriptions', 'crud')
  update(@Param('id') id: string, @Body() dto: SubscriptionPlanWriteDto) {
    return this.service.updatePlan(id, dto);
  }

  // Not in the spec's own contract table (only GET/POST/PUT listed) — added at Admin's request.
  // Blocked with a clear CONFLICT (not a raw DB error) when any customer has ever subscribed to
  // this plan; see SubscriptionsService.deletePlan()'s own comment for why hard-delete is
  // deliberately narrower than "Admin clicked delete".
  @Delete('plans/:id')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('subscriptions', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.deletePlan(id);
  }

  // Admin visibility into per-customer logo download usage — how many each subscriber has used
  // and how many they have left this cycle, across every subscriber (not just one).
  @Get('usage')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('subscriptions', 'read_only')
  usage() {
    return this.service.listAdminUsage();
  }
}
