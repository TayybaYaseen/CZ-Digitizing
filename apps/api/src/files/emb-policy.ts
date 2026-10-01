import type { Prisma } from '../generated/prisma';

// docs/specs/2026-08-28-05-private-file-management.md AC-1 — an `.EMB` file "is never returned by
// any public or customer-authenticated endpoint" (422 FILE_FORMAT_BLOCKED if one is asked for).
// Applied at both ends of customer delivery: when an order's files are released
// (OrdersService.releaseFilesAndNotify) and on every customer/guest file list and download request
// (CustomerFilesService), so even an authorization row created some other way never hands one out.
// Case-insensitive: the stored extension is upper-case today, but this must not depend on that.
export const NOT_EMB_FILE = { NOT: { fileFormat: { equals: 'EMB', mode: 'insensitive' } } } satisfies Prisma.DesignFileWhereInput;

export function isEmbFormat(fileFormat: string): boolean {
  return fileFormat.trim().toUpperCase() === 'EMB';
}
