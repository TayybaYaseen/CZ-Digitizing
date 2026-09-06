import { Body, Controller, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { UpdatePreferredLocaleDto } from './dto/update-preferred-locale.dto';
import { I18nService } from './i18n.service';

// AC-4 — persists a logged-in customer's language choice across visits. No @Roles() — any
// authenticated role, scoped to the caller's own account, same shape as
// NotificationsCustomerController.
@ApiTags('i18n')
@ApiBearerAuth()
@Controller('api/account')
export class I18nAccountController {
  constructor(private readonly service: I18nService) {}

  @Put('preferred-locale')
  updatePreferredLocale(@Body() dto: UpdatePreferredLocaleDto, @CurrentUser() user: AccessTokenPayload) {
    return this.service.setPreferredLocale(BigInt(user.sub), dto.locale);
  }
}
