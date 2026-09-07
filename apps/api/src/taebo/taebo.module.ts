import { Module } from '@nestjs/common';
import { FaqModule } from '../faq/faq.module';
import { TaeboAdminController } from './taebo-admin.controller';
import { TaeboController } from './taebo.controller';
import { TaeboMatchingService } from './taebo-matching.service';
import { TaeboService } from './taebo.service';

@Module({
  imports: [FaqModule],
  controllers: [TaeboController, TaeboAdminController],
  providers: [TaeboService, TaeboMatchingService],
})
export class TaeboModule {}
