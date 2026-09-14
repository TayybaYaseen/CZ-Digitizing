import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomRequestFilesService } from './custom-request-files.service';
import { CustomRequestProductionService } from './custom-request-production.service';
import { CustomRequestsController } from './custom-requests.controller';
import { CustomRequestsGateway } from './custom-requests.gateway';
import { CustomRequestsService } from './custom-requests.service';

@Module({
  imports: [FilesModule, OrdersModule, AuthModule],
  controllers: [CustomRequestsController],
  providers: [CustomRequestsService, CustomRequestFilesService, CustomRequestProductionService, CustomRequestsGateway],
  exports: [CustomRequestsService],
})
export class CustomRequestsModule {}
