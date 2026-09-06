import { Module } from '@nestjs/common';
import { I18nAccountController } from './i18n-account.controller';
import { I18nAdminController } from './i18n-admin.controller';
import { I18nPublicController } from './i18n-public.controller';
import { I18nService } from './i18n.service';

@Module({
  controllers: [I18nAdminController, I18nPublicController, I18nAccountController],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
