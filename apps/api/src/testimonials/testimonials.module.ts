import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ReviewImageService } from './review-image.service';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  // FilesModule — StorageService (private, content-addressed) for A-026 review images.
  imports: [FilesModule],
  controllers: [TestimonialsController],
  providers: [TestimonialsService, ReviewImageService],
})
export class TestimonialsModule {}
