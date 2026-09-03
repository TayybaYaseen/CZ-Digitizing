import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { publishedOnlyFor } from '../designs/staff-visibility.util';
import { DynamicBundleRulesService } from './dynamic-bundle-rules.service';
import { CreateDynamicBundleRuleDto, UpdateDynamicBundleRuleDto } from './dto/dynamic-bundle-rule.dto';

// AC-6. Application at checkout is TODO(A-011) — see dynamic-bundle-rules.service.ts.
@ApiTags('bundles')
@Controller('api/bundles/dynamic-rules')
export class DynamicBundleRulesController {
  constructor(private readonly service: DynamicBundleRulesService) {}

  @Get()
  @Public()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(!publishedOnlyFor(req));
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateDynamicBundleRuleDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateDynamicBundleRuleDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('bundles', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
