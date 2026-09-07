import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AccountService } from './account.service';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-14. Not a public
// route in the spec's own §3 table — added so Admin's "Customer Activity panel" (AdminActivityController)
// has a customer to find/select in the first place. Bare @Roles('admin'), same posture as the
// activity panel itself — a cross-cutting support view, not tied to any single AdminModule permission.
@ApiTags('admin-customers')
@ApiBearerAuth()
@Controller('api/admin/customers')
export class AdminCustomersController {
  constructor(private readonly account: AccountService) {}

  @Get()
  @Roles('admin')
  async list(@Query() query: AdminCustomerQueryDto) {
    const { items, total } = await this.account.adminListCustomers(query.search, query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get(':id')
  @Roles('admin')
  get(@Param('id') id: string) {
    return this.account.getProfile(BigInt(id));
  }
}
