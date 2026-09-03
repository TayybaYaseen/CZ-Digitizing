import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateAllowedFileFormatDto, UpdateAllowedFileFormatDto } from './dto/file-format.dto';
import { FileFormatService } from './file-format.service';

// docs/specs/2026-08-28-05-private-file-management.md §3 (aspect A-007, AC-13/AC-14).
@ApiTags('admin/settings/file-formats')
@ApiBearerAuth()
@Controller('api/admin/settings/file-formats')
@Roles('admin', 'freelancer', 'moderator')
export class FileFormatController {
  constructor(private readonly service: FileFormatService) {}

  @Get()
  @RequiresPermission('settings', 'read_only')
  list() {
    return this.service.list();
  }

  @Post()
  @RequiresPermission('settings', 'crud')
  create(@Body() dto: CreateAllowedFileFormatDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @RequiresPermission('settings', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateAllowedFileFormatDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }
}
