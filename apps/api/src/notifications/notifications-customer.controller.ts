import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { RateLimiterService } from '../common/rate-limit/rate-limiter.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationService } from './services/notification.service';

// docs/specs/2026-08-28-02-notifications-system.md §3 (customer routes proposed by the spec —
// absent from the architecture's own endpoint inventory, per spec §8 risk #1) plus the AC-9
// preference-center endpoints, also proposed since none exist in the architecture inventory
// either. No @Roles() — any authenticated role, scoped to the caller's own notifications.
@Controller('api/notifications')
export class NotificationsCustomerController {
  constructor(
    private readonly service: NotificationService,
    private readonly preferences: NotificationPreferenceService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Get()
  async list(@Query() query: NotificationQueryDto, @CurrentUser() user: AccessTokenPayload) {
    const { items, total } = await this.service.list(BigInt(user.sub), query.page, query.pageSize, query.isRead);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AccessTokenPayload) {
    return { count: await this.service.unreadCount(BigInt(user.sub)) };
  }

  @Put(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.service.markRead(BigInt(user.sub), id);
  }

  // AC-9 — full type×channel matrix with `enabled` computed, so the frontend never needs to know
  // the default-true rule itself.
  @Get('preferences')
  async getPreferences(@CurrentUser() user: AccessTokenPayload) {
    return this.preferences.getMatrix(BigInt(user.sub));
  }

  @Put('preferences')
  async updatePreferences(@Body() dto: UpdateNotificationPreferencesDto, @CurrentUser() user: AccessTokenPayload) {
    await this.rateLimiter.consume(`notifications:preferences:${user.sub}`, 20, 60);
    await this.preferences.upsertMany(BigInt(user.sub), dto.preferences);
  }
}
