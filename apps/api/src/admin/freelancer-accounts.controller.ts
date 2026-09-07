import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateFreelancerAccountDto } from './dto/create-freelancer-account.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { FreelancerAccountsService } from './freelancer-accounts.service';

@ApiTags('admin/freelancer-accounts')
@ApiBearerAuth()
@Controller('api/admin/freelancer-accounts')
@Roles('admin')
export class FreelancerAccountsController {
  constructor(private readonly service: FreelancerAccountsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateFreelancerAccountDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.revoke(id, admin);
  }

  @Put(':id/permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdatePermissionsDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.updatePermissions(id, dto, admin);
  }

  @Get(':id/sessions')
  listSessions(@Param('id') id: string) {
    return this.service.listSessions(id);
  }

  @Delete(':id/sessions/:sessionId')
  @HttpCode(204)
  async revokeSession(@Param('id') id: string, @Param('sessionId') sessionId: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.revokeSession(id, sessionId, admin);
  }
}
