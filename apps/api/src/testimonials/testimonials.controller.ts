import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateTestimonialDto, ModerateTestimonialDto, SubmitTestimonialDto, UpdateTestimonialDto } from './dto/testimonial-write.dto';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@Controller('api/testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

  @Get()
  @Public()
  list(@Query('scope') scope?: 'home' | 'all') {
    return this.service.list(scope);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'read_only')
  listAdmin() {
    return this.service.listAdmin();
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  update(@Param('id') id: string, @Body() dto: UpdateTestimonialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, admin);
  }

  // AC-7 — customer submits a review tied to one of their own completed orders.
  @Post('submit')
  @ApiBearerAuth()
  @Roles('customer')
  @HttpCode(201)
  submit(@Body() dto: SubmitTestimonialDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.submit(dto, BigInt(user.sub));
  }

  @Put(':id/moderate')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  moderate(@Param('id') id: string, @Body() dto: ModerateTestimonialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.moderate(id, dto.decision, admin);
  }
}
