import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { CustomerFilesController } from './customer-files.controller';
import { CustomerFilesService } from './customer-files.service';
import { DesignFilesController } from './design-files.controller';
import { DesignFilesService } from './design-files.service';
import { FileFormatController } from './file-format.controller';
import { FileFormatService } from './file-format.service';
import { StorageService } from './storage.service';
import { WatermarkService } from './watermark.service';
import { ZipService } from './zip.service';

@Module({
  imports: [ActivityModule],
  controllers: [FileFormatController, DesignFilesController, CustomerFilesController],
  providers: [StorageService, FileFormatService, DesignFilesService, CustomerFilesService, WatermarkService, ZipService],
  // CustomerFilesService is exported for GuestOrdersController (OrdersModule): a guest's file list and
  // download go through the very same payment gate and .EMB exclusion as a signed-in customer's.
  exports: [StorageService, ZipService, DesignFilesService, CustomerFilesService],
})
export class FilesModule {}
