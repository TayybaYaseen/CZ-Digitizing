import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CreateTestimonialDto, ModerateTestimonialDto, SetTestimonialVisibilityDto, SubmitTestimonialDto, UpdateTestimonialDto } from './dto/testimonial-write.dto';
import { PUBLIC_IMAGE_MAX_AGE_SECONDS, REVIEW_IMAGE_MAX_BYTES } from './testimonials.constants';
import { TestimonialsService } from './testimonials.service';

// memoryStorage: the file is size-capped, sniffed and re-encoded before anything touches disk (§8).
const imageUpload = () => FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: REVIEW_IMAGE_MAX_BYTES, files: 1 } });

// Same hardening headers as the A-013 receipt preview: the bytes are always a re-encoded WebP, but
// the response still forbids sniffing and any active content.
function sendImage(res: Response, image: { buffer: Buffer; contentType: string; filename: string }, cacheControl: string) {
  res.set({
    'Content-Type': image.contentType,
    'Content-Disposition': `inline; filename="${image.filename}"`,
    'Content-Length': String(image.buffer.length),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': cacheControl,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    // The public site and admin app are different origins from the API.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(image.buffer);
}

// docs/specs/2026-08-28-10-content-knowledge-base.md (A-012c) +
// docs/specs/2026-10-06-22-customer-review-submission.md §26 (A-026). Literal segments (admin,
// mine, submit) are declared before the :id routes. Image routes use bare @Res() so the global
// ResponseInterceptor does not wrap the bytes in a `{ data }` envelope.
@ApiTags('testimonials')
@Controller('api/testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

  // ── Public ──
  @Get()
  @Public()
  list(@Query('scope') scope?: 'home' | 'all') {
    return this.service.list(scope);
  }

  // ── Admin ──
  @Get('admin')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'read_only')
  listAdmin() {
    return this.service.listAdmin();
  }

  @Get('admin/:id/image')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'read_only')
  async adminImage(@Param('id') id: string, @Res() res: Response) {
    sendImage(res, await this.service.getAdminImage(id), 'private, no-store');
  }

  // ── Customer ──
  @Get('mine/eligibility')
  @ApiBearerAuth()
  @Roles('customer')
  eligibility(@CurrentUser() user: AccessTokenPayload) {
    return this.service.eligibility(BigInt(user.sub));
  }

  @Get('mine')
  @ApiBearerAuth()
  @Roles('customer')
  listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.service.listMine(BigInt(user.sub));
  }

  @Get('mine/:id/image')
  @ApiBearerAuth()
  @Roles('customer')
  async myImage(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload, @Res() res: Response) {
    sendImage(res, await this.service.getMyImage(id, BigInt(user.sub)), 'private, no-store');
  }

  @Delete('mine/:id')
  @ApiBearerAuth()
  @Roles('customer')
  @HttpCode(204)
  async withdraw(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.service.withdraw(id, BigInt(user.sub));
  }

  // A-012c AC-7 / A-026 §7 — multipart (optional `image`) or JSON. Always stored Pending.
  @Post('submit')
  @ApiBearerAuth()
  @Roles('customer')
  @RateLimit(5, 60)
  @UseInterceptors(imageUpload())
  @HttpCode(201)
  submit(@Body() dto: SubmitTestimonialDto, @CurrentUser() user: AccessTokenPayload, @UploadedFile() image?: Express.Multer.File) {
    return this.service.submit(dto, BigInt(user.sub), image);
  }

  // ── Admin writes ──
  @Post()
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  @HttpCode(201)
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.create(dto, admin);
  }

  // ── Public image (after the literal routes) ──
  @Get(':id/image')
  @Public()
  async publicImage(@Param('id') id: string, @Res() res: Response) {
    sendImage(res, await this.service.getPublicImage(id), `public, max-age=${PUBLIC_IMAGE_MAX_AGE_SECONDS}`);
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

  @Put(':id/moderate')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  moderate(@Param('id') id: string, @Body() dto: ModerateTestimonialDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.moderate(id, dto.decision, admin);
  }

  @Put(':id/visibility')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  setVisibility(@Param('id') id: string, @Body() dto: SetTestimonialVisibilityDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.setVisibility(id, dto.isPublished, admin);
  }

  @Put(':id/image')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  @UseInterceptors(imageUpload())
  replaceImage(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload, @UploadedFile() image?: Express.Multer.File) {
    return this.service.replaceImage(id, image, admin);
  }

  @Delete(':id/image')
  @ApiBearerAuth()
  @Roles('admin', 'freelancer', 'moderator')
  @RequiresPermission('testimonials', 'crud')
  removeImage(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.removeImage(id, admin);
  }
}
