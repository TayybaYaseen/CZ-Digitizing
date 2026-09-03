import { Module } from '@nestjs/common';
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
  controllers: [FileFormatController, DesignFilesController, CustomerFilesController],
  providers: [StorageService, FileFormatService, DesignFilesService, CustomerFilesService, WatermarkService, ZipService],
  exports: [StorageService, ZipService],
})
export class FilesModule {}
