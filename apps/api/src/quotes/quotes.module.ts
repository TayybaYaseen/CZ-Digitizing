import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { OrdersModule } from '../orders/orders.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [FilesModule, OrdersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
