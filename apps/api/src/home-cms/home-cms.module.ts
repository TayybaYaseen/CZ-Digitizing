import { Module } from '@nestjs/common';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';
import { HeaderMediaController } from './header-media.controller';
import { HeaderMediaService } from './header-media.service';
import { HomeSectionsController } from './home-sections.controller';
import { HomeSectionsService } from './home-sections.service';

// docs/specs/2026-08-28-13-home-promotions-cms.md (aspect A-018, A-018a/b/c) — one module, three
// controller/service pairs, mirroring bundles/'s multi-controller-one-module shape.
@Module({
  controllers: [HomeSectionsController, AdvertisementsController, HeaderMediaController],
  providers: [HomeSectionsService, AdvertisementsService, HeaderMediaService],
})
export class HomeCmsModule {}
