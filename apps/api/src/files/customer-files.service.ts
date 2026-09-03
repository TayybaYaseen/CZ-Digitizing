import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthorizedFileDto } from './dto/customer-authorized-file.dto';
import { StorageService } from './storage.service';

const DOWNLOAD_TOKEN_TTL_SECONDS = 10 * 60; // AC-4 — 10-minute expiry

// docs/specs/2026-08-28-05-private-file-management.md §4 (aspect A-007, AC-4/5/6/8/9/11).
//
// TODO(A-013): every method here is gated on an `orders` row's payment_confirmed status, but no
// Order model exists yet — Orders (A-013) is declared as DEPENDING ON this aspect in
// docs/specs/SPEC_INDEX.md, not the reverse, so this can't be built against a real order today.
// listAuthorizedFiles/requestDownload therefore always return 422 PAYMENT_NOT_CONFIRMED (never a
// silent bypass — AC-5's error contract is real even though the gate has nothing to check against
// yet). incrementDownload/checkAttemptLimit are implemented and unit-tested directly against the
// service so AC-6/AC-11's logic is proven correct now and only needs the gate wired in once
// Orders exists.
@Injectable()
export class CustomerFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listAuthorizedFiles(_orderId: string, _customerId: bigint): Promise<AuthorizedFileDto[]> {
    throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Orders are not available yet — this design has not been purchased');
  }

  async requestDownload(_orderId: string, _fileId: string, _customerId: bigint): Promise<{ downloadUrl: string; expiresAt: Date }> {
    throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Orders are not available yet — this design has not been purchased');
  }

  // AC-6 — increments on every successful download and stamps first/last download timestamps.
  // Called by the (currently unreachable) download endpoint once Orders exists; exercised directly
  // in customer-files.service.spec.ts today.
  async incrementDownload(authorizedFileId: bigint): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.customerAuthorizedFile.findUniqueOrThrow({ where: { id: authorizedFileId } });
    await this.prisma.customerAuthorizedFile.update({
      where: { id: authorizedFileId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadAt: now,
        firstDownloadAt: existing.firstDownloadAt ?? now,
      },
    });
  }

  // AC-11 — Admin sets a per-record max-download-attempt count; exceeding it returns FORBIDDEN
  // until Admin resets it (resetAttempts below).
  async checkAttemptLimit(authorizedFileId: bigint): Promise<void> {
    const row = await this.prisma.customerAuthorizedFile.findUniqueOrThrow({ where: { id: authorizedFileId } });
    if (row.maxDownloadAttempts !== null && row.downloadCount >= row.maxDownloadAttempts) {
      throw new ApiException('FORBIDDEN', 403, 'Download-attempt limit reached for this file');
    }
  }

  async resetAttempts(authorizedFileId: bigint): Promise<void> {
    await this.prisma.customerAuthorizedFile.update({ where: { id: authorizedFileId }, data: { downloadCount: 0 } });
  }

  generateDownloadToken(fileId: string) {
    return this.storage.generateSignedToken(fileId, DOWNLOAD_TOKEN_TTL_SECONDS);
  }
}
