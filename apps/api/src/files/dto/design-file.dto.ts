import type { DesignFile } from '../../generated/prisma';

// Admin-facing shape — includes internal fields (storagePath excluded) that an Admin needs to
// manage files but a customer must never see. Never includes storage_path (spec §3 note).
export interface DesignFileAdminDto {
  id: string;
  designId: string;
  fileFormat: string;
  fileSizeBytes: number;
  isPrivate: boolean;
  contentValidated: boolean;
  versionNumber: number;
  supersededByFileId: string | null;
  createdAt: string;
}

export function toDesignFileAdminDto(row: DesignFile): DesignFileAdminDto {
  return {
    id: row.id.toString(),
    designId: row.designId.toString(),
    fileFormat: row.fileFormat,
    fileSizeBytes: Number(row.fileSizeBytes),
    isPrivate: row.isPrivate,
    contentValidated: row.contentValidated,
    versionNumber: row.versionNumber,
    supersededByFileId: row.supersededByFileId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
