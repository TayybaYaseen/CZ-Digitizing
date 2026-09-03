import { Module } from '@nestjs/common';
import { CategoriesController, SubcategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';

@Module({
  controllers: [CategoriesController, SubcategoriesController, DesignsController],
  providers: [CategoriesService, DesignsService],
})
export class DesignsModule {}
