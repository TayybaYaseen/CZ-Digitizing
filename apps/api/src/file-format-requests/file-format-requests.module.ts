import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FileFormatRequestsController } from './file-format-requests.controller';
import { FileFormatRequestsService } from './file-format-requests.service';

@Module({
  imports: [FilesModule],
  controllers: [FileFormatRequestsController],
  providers: [FileFormatRequestsService],
})
export class FileFormatRequestsModule {}
