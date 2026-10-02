import { Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUploadService, MAX_VIDEO_BYTES } from './image-upload.service';

// Admin's Advertisement form only had a pasted "video URL" field, so a video file on the admin's
// machine could never become an ad banner. Same public storage as ImageUploadController; gated on
// the advertisements module since ad banners are its only consumer. multer's own fileSize limit
// (one byte over, so the service's friendlier 413 message wins at exactly the limit) stops an
// oversized upload before it is fully buffered in memory.
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('api/uploads/videos')
@Roles('admin', 'freelancer', 'moderator')
@RequiresPermission('advertisements', 'crud')
export class VideoUploadController {
  constructor(private readonly service: ImageUploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES + 1 } }))
  @HttpCode(201)
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveVideo(file);
  }
}
