import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { I18nService } from './i18n.service';

// AC-1/AC-3 — public, unauthenticated endpoints every page needs before a user is known: the
// enabled-languages list for the selector, and the translation bundle for whichever locale is
// active. Separate controller so @Public() never risks leaking onto an admin-only route.
@ApiTags('i18n')
@Controller('api')
export class I18nPublicController {
  constructor(private readonly service: I18nService) {}

  @Get('languages')
  @Public()
  listLanguages() {
    return this.service.listLanguages(false);
  }

  @Get('translations/:locale')
  @Public()
  getTranslations(@Param('locale') locale: string) {
    return this.service.getTranslationBundle(locale);
  }
}
