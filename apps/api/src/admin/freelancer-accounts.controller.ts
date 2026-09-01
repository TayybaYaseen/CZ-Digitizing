import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateFreelancerAccountDto } from './dto/create-freelancer-account.dto';
import { FreelancerAccountsService } from './freelancer-accounts.service';

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
}
