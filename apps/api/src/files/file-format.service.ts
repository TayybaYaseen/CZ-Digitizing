import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAllowedFileFormatDto, UpdateAllowedFileFormatDto } from './dto/file-format.dto';
import { toAllowedFileFormatDto, type AllowedFileFormatDto } from './dto/file-format.dto';

// docs/specs/2026-08-28-05-private-file-management.md §4 (aspect A-007, AC-13/AC-14).
@Injectable()
export class FileFormatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(): Promise<AllowedFileFormatDto[]> {
    const rows = await this.prisma.allowedFileFormat.findMany({ orderBy: { extension: 'asc' } });
    return rows.map(toAllowedFileFormatDto);
  }

  async create(dto: CreateAllowedFileFormatDto, admin: AccessTokenPayload): Promise<AllowedFileFormatDto> {
    const extension = dto.extension.toUpperCase();
    const existing = await this.prisma.allowedFileFormat.findUnique({ where: { extension } });
    if (existing) throw new ApiException('CONFLICT', 409, `Format "${extension}" already exists`);

    // AC-14 — a new row is never seeded locked; only the migration's EMB row carries is_locked.
    const row = await this.prisma.allowedFileFormat.create({
      data: {
        extension,
        displayName: dto.displayName,
        isPrivate: dto.isPrivate ?? false,
        isActive: dto.isActive ?? true,
        maxFileSizeMb: dto.maxFileSizeMb ?? 50,
      },
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'FILE_FORMAT_CREATED',
      resourceType: 'allowed_file_format',
      resourceId: row.id.toString(),
      changes: { extension: row.extension, isPrivate: row.isPrivate },
    });

    return toAllowedFileFormatDto(row);
  }

  // AC-14 — "cannot be toggled off by any Admin action, regardless of who is editing it or how".
  // Enforced here as the application-level gate; the locked_format_stays_private CHECK constraint
  // (migration 20260903040500) is the DB-level backstop, same posture as design_files'
  // emb_never_public (AC-2) — a direct DB write bypassing this service is rejected too.
  async update(id: string, dto: UpdateAllowedFileFormatDto, admin: AccessTokenPayload): Promise<AllowedFileFormatDto> {
    const row = await this.findOrThrow(id);

    if (row.isLocked && dto.isPrivate === false) {
      throw new ApiException('FILE_FORMAT_BLOCKED', 422, `"${row.extension}" is permanently private and cannot be unlocked`);
    }

    const updated = await this.prisma.allowedFileFormat.update({
      where: { id: BigInt(id) },
      data: {
        displayName: dto.displayName,
        // A locked row's isPrivate is never written, even to the same value, keeping the audit
        // trail free of no-op "changed" entries on the one row that must never actually change.
        isPrivate: row.isLocked ? undefined : dto.isPrivate,
        isActive: dto.isActive,
        maxFileSizeMb: dto.maxFileSizeMb,
      },
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'FILE_FORMAT_UPDATED',
      resourceType: 'allowed_file_format',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });

    return toAllowedFileFormatDto(updated);
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.allowedFileFormat.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File format not found');
    return row;
  }
}
