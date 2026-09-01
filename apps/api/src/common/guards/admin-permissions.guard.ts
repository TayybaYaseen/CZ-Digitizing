import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../exceptions/api-exception';
import { REQUIRES_PERMISSION_KEY, type RequiredPermission } from '../decorators/requires-permission.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

// AC-8 — freelancer/moderator (limited-admin) module scoping. role=admin bypasses this
// entirely (full system access, per architecture's RBAC table). Must run after JwtAuthGuard.
@Injectable()
export class AdminPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRES_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user.role === 'admin') return true;

    const permission = await this.prisma.adminPermission.findFirst({
      where: { userId: BigInt(req.user.sub), module: required.module, revokedAt: null },
    });
    const satisfied = permission && (permission.accessLevel === 'crud' || required.level === 'read_only');
    if (satisfied) return true;

    await this.audit.record({
      adminUserId: BigInt(req.user.sub),
      actionType: 'ACCESS_DENIED',
      resourceType: required.module,
      resourceId: `${req.method} ${req.originalUrl}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw new ApiException('FORBIDDEN', 403, `You do not have ${required.level} access to ${required.module}`);
  }
}
