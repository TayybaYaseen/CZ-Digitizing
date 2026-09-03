import { extname } from 'path';
import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { DesignFile } from '../generated/prisma';
import { toDesignFileAdminDto, type DesignFileAdminDto } from './dto/design-file.dto';
import { checkMagicBytes } from './magic-bytes';
import { StorageService } from './storage.service';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // AC-7 — 50MB per file
const MAX_DESIGN_TOTAL_BYTES = 250 * 1024 * 1024; // AC-7 — 250MB per design

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

// docs/specs/2026-08-28-05-private-file-management.md §4 (aspect A-007, AC-1/AC-2/AC-7/AC-12).
@Injectable()
export class DesignFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
  ) {}

  async listForDesign(designId: string): Promise<DesignFileAdminDto[]> {
    const rows = await this.prisma.designFile.findMany({
      where: { designId: BigInt(designId), supersededByFileId: null }, // AC-12 — current versions only
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDesignFileAdminDto);
  }

  async upload(designId: string, files: UploadedFileInput[], admin: AccessTokenPayload): Promise<DesignFileAdminDto[]> {
    const design = await this.prisma.design.findFirst({ where: { id: BigInt(designId), deletedAt: null } });
    if (!design) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Design not found');

    const formats = await this.prisma.allowedFileFormat.findMany({ where: { isActive: true } });
    const formatByExt = new Map(formats.map((f) => [f.extension, f]));

    const existingTotal = await this.prisma.designFile.aggregate({
      where: { designId: BigInt(designId) },
      _sum: { fileSizeBytes: true },
    });
    let runningTotal = Number(existingTotal._sum.fileSizeBytes ?? 0n);

    const created: DesignFile[] = [];
    for (const file of files) {
      const extension = extname(file.originalname).replace('.', '').toUpperCase();
      const format = formatByExt.get(extension);
      if (!format) {
        throw new ApiException('UNSUPPORTED_FILE_TYPE', 415, `"${extension}" is not an allowed embroidery file format`);
      }

      const maxBytes = format.maxFileSizeMb * 1024 * 1024;
      if (file.buffer.length > MAX_FILE_SIZE_BYTES || file.buffer.length > maxBytes) {
        throw new ApiException('FILE_TOO_LARGE', 413, `"${file.originalname}" exceeds the ${format.maxFileSizeMb}MB per-file limit`);
      }
      runningTotal += file.buffer.length;
      if (runningTotal > MAX_DESIGN_TOTAL_BYTES) {
        throw new ApiException('FILE_TOO_LARGE', 413, 'This design would exceed the 250MB total file-size limit');
      }

      const hash = this.storage.hashContent(file.buffer);
      const storagePath = await this.storage.save(file.buffer, hash);

      // AC-1 — forced true for EMB (or any format the registry marks private) unconditionally,
      // regardless of what the caller intended; AC-2's DB CHECK constraint is the real backstop.
      const isPrivate = format.isPrivate || extension === 'EMB';
      const magicByteResult = checkMagicBytes(extension, file.buffer);

      const row = await this.prisma.designFile.create({
        data: {
          designId: BigInt(designId),
          fileFormat: extension,
          storagePath,
          fileSizeBytes: BigInt(file.buffer.length),
          uploadHash: hash,
          isPrivate,
          // Only ever true when a signature check for this format actually ran and passed —
          // a format with no known signature (magicByteResult === null) never claims validation.
          contentValidated: magicByteResult === true,
          createdByAdminId: BigInt(admin.sub),
        },
      });
      created.push(row);
    }

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_FILES_UPLOADED',
      resourceType: 'design',
      resourceId: designId,
      changes: { fileCount: created.length, formats: created.map((f) => f.fileFormat) },
    });

    return created.map(toDesignFileAdminDto);
  }

  // AC-12 — replacing a file creates a new row and points the old one at it via
  // supersededByFileId, rather than overwriting; the old file's bytes stay on disk and its
  // DesignFile row is retrievable (listForDesign filters it out of the "current" view only).
  async replace(designId: string, fileId: string, file: UploadedFileInput, admin: AccessTokenPayload): Promise<DesignFileAdminDto> {
    const previous = await this.findOrThrow(designId, fileId);
    const [uploadedDto] = await this.upload(designId, [file], admin);
    const newFileId = BigInt(uploadedDto.id);

    await this.prisma.designFile.update({ where: { id: previous.id }, data: { supersededByFileId: newFileId } });
    const updatedNew = await this.prisma.designFile.update({
      where: { id: newFileId },
      data: { versionNumber: previous.versionNumber + 1 },
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_FILE_REPLACED',
      resourceType: 'design_file',
      resourceId: fileId,
      changes: { newFileId: newFileId.toString() },
    });

    return toDesignFileAdminDto(updatedNew);
  }

  async remove(designId: string, fileId: string, admin: AccessTokenPayload): Promise<void> {
    const row = await this.findOrThrow(designId, fileId);
    await this.prisma.designFile.delete({ where: { id: row.id } });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_FILE_DELETED',
      resourceType: 'design_file',
      resourceId: fileId,
    });
  }

  private async findOrThrow(designId: string, fileId: string): Promise<DesignFile> {
    const row = await this.prisma.designFile.findFirst({ where: { id: BigInt(fileId), designId: BigInt(designId) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File not found');
    return row;
  }
}
