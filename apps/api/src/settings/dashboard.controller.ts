import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { DashboardService } from './dashboard.service';

// docs/specs/2026-08-28-03-admin-platform-settings.md §3 (aspect A-005d). AC-13 — no
// @RequiresPermission gate on the route itself; every role in @Roles can load the dashboard,
// but DashboardService.resolveVisibleSections() narrows the payload per-caller instead, since
// the whole point of this endpoint is "some widgets, not a hard 403".
@ApiTags('admin/dashboard')
@ApiBearerAuth()
@Controller('api/admin/dashboard')
@Roles('admin', 'freelancer', 'moderator')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() admin: AccessTokenPayload) {
    return this.service.getStats(admin);
  }
}
