import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './dto/activity-query.dto';

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019), AC-14. Bare @Roles('admin')
// rather than @RequiresPermission — this is a cross-cutting customer-support view, not tied to any
// single AdminModule permission (orders/quotes/etc. each already gate their own detail views).
@ApiTags('admin-activity')
@ApiBearerAuth()
@Controller('api/admin/customers')
export class AdminActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get(':id/activity')
  @Roles('admin')
  async list(@Param('id') customerId: string, @Query() query: ActivityQueryDto) {
    const { items, total } = await this.activity.listForCustomer(BigInt(customerId), query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }
}
