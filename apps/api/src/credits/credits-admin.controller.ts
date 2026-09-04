import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { CreditsService } from './credits.service';
import { CreditPackageWriteDto } from './dto/credit-write.dto';

// docs/specs/2026-08-28-09-subscriptions-credits.md §3 — package CRUD (role=admin). Mounted at
// 'api/credits/admin' rather than the spec table's literal '/packages'/'/packages/:id' under
// 'api/credits': that literal reading collides with CreditsController's own @Get('packages')
// @Public() at the exact same path/method — Nest/Express resolve duplicate-path routes by
// registration order, and CreditsController registers first (credits.module.ts), so every GET
// here silently fell through to the *public*, published-only handler. Admin could never see or
// manage a draft/unpublished package, and the read_only/crud permission gate on this list was
// never actually enforced. Same fix, same reasoning as SubscriptionsAdminController's own comment.
@ApiTags('credits-admin')
@ApiBearerAuth()
@Controller('api/credits/admin')
export class CreditsAdminController {
  constructor(private readonly service: CreditsService) {}

  @Get('packages')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('credits', 'read_only')
  list() {
    return this.service.listAdminPackages();
  }

  @Post('packages')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('credits', 'crud')
  create(@Body() dto: CreditPackageWriteDto) {
    return this.service.createPackage(dto);
  }

  @Put('packages/:id')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('credits', 'crud')
  update(@Param('id') id: string, @Body() dto: CreditPackageWriteDto) {
    return this.service.updatePackage(id, dto);
  }

  // Not in the spec's own contract table (only GET/POST/PUT listed) — added alongside
  // SubscriptionsAdminController's own delete for the same reason. Always safe here (see
  // CreditsService.deletePackage()'s own comment — no FK references a package).
  @Delete('packages/:id')
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('credits', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.deletePackage(id);
  }
}
