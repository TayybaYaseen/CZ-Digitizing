import { SetMetadata } from '@nestjs/common';
import type { AdminAccessLevel, AdminModule } from '../../generated/prisma';

export const REQUIRES_PERMISSION_KEY = 'requiresPermission';

export interface RequiredPermission {
  module: AdminModule;
  level: AdminAccessLevel;
}

// Gates a route for freelancer/moderator (limited-admin) callers by AC-8's per-module scoping.
// role=admin always passes (see AdminPermissionsGuard) — this only narrows non-admin access.
export const RequiresPermission = (module: AdminModule, level: AdminAccessLevel = 'read_only') =>
  SetMetadata(REQUIRES_PERMISSION_KEY, { module, level } satisfies RequiredPermission);
