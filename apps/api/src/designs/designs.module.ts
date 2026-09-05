import { Module } from '@nestjs/common';
import { BlogModule } from '../blog/blog.module';
import { CategoriesController, SubcategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { ImageUploadController } from './image-upload.controller';
import { ImageUploadService } from './image-upload.service';

// AC-14 (Content & Knowledge Base spec) — imports BlogModule so DesignsService.searchSuggestions()
// can fold in matching published Blog post titles, per the Design Catalog spec's own AC-6 search
// scope (see designs.service.ts's TODO(A-014, A-012d) note this closes out).
@Module({
  imports: [BlogModule],
  controllers: [CategoriesController, SubcategoriesController, DesignsController, ImageUploadController],
  providers: [CategoriesService, DesignsService, ImageUploadService],
})
export class DesignsModule {}
