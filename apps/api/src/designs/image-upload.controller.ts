import { Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ImageUploadService } from './image-upload.service';

// Admin's "Create design" step previously only accepted a pasted URL for previewImageUrl — this
// gives it a real upload endpoint. Public output URL, unlike A-007's private embroidery files.
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('api/uploads/images')
@Roles('admin', 'freelancer', 'moderator')
@RequiresPermission('designs', 'crud')
export class ImageUploadController {
  constructor(private readonly service: ImageUploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @HttpCode(201)
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveImage(file);
  }
}
