import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationService } from './services/notification.service';

// docs/specs/2026-08-28-02-notifications-system.md §3. Spec's `PagedResponse<NotificationDto>`
// maps onto the codebase's existing ApiResponse<T[]> + meta convention (packages/shared-types) —
// no separate paging type introduced. Scoped to the calling admin's own notifications, same as
// the customer controller — the only difference is the @Roles('admin') gate.
@Controller('api/admin/notifications')
@Roles('admin')
export class NotificationsAdminController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async list(@Query() query: NotificationQueryDto, @CurrentUser() admin: AccessTokenPayload) {
    const { items, total } = await this.service.list(BigInt(admin.sub), query.page, query.pageSize, query.isRead);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() admin: AccessTokenPayload) {
    return { count: await this.service.unreadCount(BigInt(admin.sub)) };
  }

  // AC-8 — marking read never touches the underlying business record; unread count updates
  // immediately since it's a live count query, not a cached value.
  @Put(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.markRead(BigInt(admin.sub), id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(BigInt(admin.sub), id);
  }
}
