import type { CustomerAuthorizedFile, DesignFile } from '../../generated/prisma';

// docs/specs/2026-08-28-05-private-file-management.md §3 — "Never includes storage_path,
// upload_hash, or the real filename". EMB can never appear here — DesignFilesService forces
// is_private=true for it (AC-1) and CustomerFilesService only ever authorizes non-private files.
export interface AuthorizedFileDto {
  id: string;
  designId: string;
  fileFormat: string;
  fileSizeBytes: number;
  downloadUrl?: string; // present only from the /download endpoint response, 10-min TTL
}

export function toAuthorizedFileDto(row: CustomerAuthorizedFile & { designFile: DesignFile }, downloadUrl?: string): AuthorizedFileDto {
  return {
    id: row.id.toString(),
    designId: row.designFile.designId.toString(),
    fileFormat: row.designFile.fileFormat,
    fileSizeBytes: Number(row.designFile.fileSizeBytes),
    downloadUrl,
  };
}
