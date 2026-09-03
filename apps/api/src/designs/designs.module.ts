import { Module } from '@nestjs/common';
import { CategoriesController, SubcategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { ImageUploadController } from './image-upload.controller';
import { ImageUploadService } from './image-upload.service';

@Module({
  controllers: [CategoriesController, SubcategoriesController, DesignsController, ImageUploadController],
  providers: [CategoriesService, DesignsService, ImageUploadService],
})
export class DesignsModule {}
