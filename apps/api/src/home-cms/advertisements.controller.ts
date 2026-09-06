import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { AdvertisementsService } from './advertisements.service';
import { CreateAdvertisementDto, UpdateAdvertisementDto } from './dto/advertisement-write.dto';

@ApiTags('home')
@Controller()
export class AdvertisementsController {
  constructor(private readonly service: AdvertisementsService) {}

  @Get('api/home/advertisement')
  @Public()
  async getActive() {
    return this.service.getActive();
  }

  @Get('api/admin/advertisements')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('advertisements', 'read_only')
  listAdmin() {
    return this.service.listAdmin();
  }

  @Post('api/admin/advertisements')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('advertisements', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateAdvertisementDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put('api/admin/advertisements/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('advertisements', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateAdvertisementDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete('api/admin/advertisements/:id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('advertisements', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }
}
