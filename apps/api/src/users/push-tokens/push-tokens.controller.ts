import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../../auth/token.types';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushTokensService } from './push-tokens.service';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3 (aspect A-023). No @Roles() — any
// authenticated role (customer or admin) can register a mobile device token, matching the spec's
// "Authenticated customer or admin" auth column.
@ApiTags('push-tokens')
@ApiBearerAuth()
@Controller('api/users/push-token')
export class PushTokensController {
  constructor(private readonly service: PushTokensService) {}

  @Post()
  async register(@Body() dto: RegisterPushTokenDto, @CurrentUser() user: AccessTokenPayload) {
    const row = await this.service.register(BigInt(user.sub), dto.token, dto.platform);
    return { id: row.id.toString(), token: row.token, platform: row.platform };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deregister(@Param('token') token: string, @CurrentUser() user: AccessTokenPayload) {
    await this.service.deregister(BigInt(user.sub), token);
  }
}
