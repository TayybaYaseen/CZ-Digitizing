import { Module } from '@nestjs/common';
import { QuoteQuestionsController } from './quote-questions.controller';
import { QuoteQuestionsService } from './quote-questions.service';

@Module({
  controllers: [QuoteQuestionsController],
  providers: [QuoteQuestionsService],
  exports: [QuoteQuestionsService],
})
export class QuoteQuestionsModule {}
