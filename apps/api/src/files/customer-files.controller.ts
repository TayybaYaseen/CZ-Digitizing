import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { CustomerFilesService } from './customer-files.service';

// docs/specs/2026-08-28-05-private-file-management.md §3 (aspect A-007, AC-4/5/6/8/9).
// TODO(A-013): both routes always 422 PAYMENT_NOT_CONFIRMED today — see CustomerFilesService's
// header comment. The contract (route shape, auth, response envelope) is real; only the order
// lookup underneath it is stubbed.
@ApiTags('orders/files')
@ApiBearerAuth()
@Controller('api/orders/:id/files')
@Roles('customer')
export class CustomerFilesController {
  constructor(private readonly service: CustomerFilesService) {}

  @Get()
  list(@Param('id') orderId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.service.listAuthorizedFiles(orderId, BigInt(user.sub));
  }

  @Post(':fileId/download')
  @HttpCode(200)
  download(@Param('id') orderId: string, @Param('fileId') fileId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.service.requestDownload(orderId, fileId, BigInt(user.sub));
  }
}
