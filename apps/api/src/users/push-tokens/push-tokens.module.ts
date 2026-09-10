import { Module } from '@nestjs/common';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md (aspect A-023). Exported so
// NotificationPushService (notifications module) can resolve a user's registered device tokens
// without this module needing to be @Global() itself.
@Module({
  controllers: [PushTokensController],
  providers: [PushTokensService],
  exports: [PushTokensService],
})
export class PushTokensModule {}
