import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@czd/shared-types';
import { AuditLogService } from '../../audit/audit-log.service';
import { ApiException } from '../exceptions/api-exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

// AC-9 — every rejection here (403) is written to audit_logs. Must run after JwtAuthGuard
// (needs req.user).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (required.includes(req.user.role)) return true;

    await this.audit.record({
      adminUserId: BigInt(req.user.sub),
      actionType: 'ACCESS_DENIED',
      resourceType: 'route',
      resourceId: `${req.method} ${req.originalUrl}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw new ApiException('FORBIDDEN', 403, 'You do not have permission to perform this action');
  }
}
