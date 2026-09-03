import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PublicSettingsController, SettingsController } from './settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  controllers: [SettingsController, PublicSettingsController, DashboardController],
  providers: [PlatformSettingsService, DashboardService],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
