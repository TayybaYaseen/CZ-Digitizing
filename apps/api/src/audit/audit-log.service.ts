import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Best-effort observability, not a transactional gate: every caller does its real write first
  // and awaits this afterward (see e.g. PlatformSettingsService.updatePaymentMethods) — if this
  // throws (e.g. adminUserId's FK is stale because that admin row was deleted/reseeded after the
  // token was issued), the real write must not be reported as failed to the caller. Swallowing
  // here, not there, keeps every call site simple and consistent. See
  // docs/incidents/2026-09-07-bank-transfer-details-not-showing.md.
  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
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
    } catch (err) {
      this.logger.error(`Failed to write audit log (actionType=${entry.actionType}, resourceType=${entry.resourceType})`, err instanceof Error ? err.stack : err);
    }
  }
}
