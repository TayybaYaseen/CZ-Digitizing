import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  adminUserId?: bigint;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// AC-9 — every forbidden Admin/private-file attempt is written here; admin writes elsewhere
// (freelancer account create/revoke, 2FA confirm) log on success too.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        adminUserId: entry.adminUserId,
        actionType: entry.actionType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}
