import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api-exception';
import { statusAllowsFileAccess } from '../orders/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { toAuthorizedFileDto, type AuthorizedFileDto } from './dto/customer-authorized-file.dto';
import { StorageService } from './storage.service';

const DOWNLOAD_TOKEN_TTL_SECONDS = 10 * 60; // AC-4 — 10-minute expiry

// docs/specs/2026-08-28-05-private-file-management.md §4 (aspect A-007, AC-4/5/6/8/9/11), wired to
// a real Order per docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013).
//
// Gate is `statusAllowsFileAccess` (order-state-machine.ts), not a bare `=== 'payment_confirmed'`
// literal check — AC-6's own wording ("payment_status is anything other than completed") and this
// feature's own state machine mean files stay reachable through processing/ready/completed too,
// not just the instant of confirmation. `paymentStatus` is checked in addition to `status`: a
// refunded order's status can still read e.g. `processing` if only a partial refund was issued
// (Order.paymentStatus's own doc comment) — AC-11's "previously-released file access is
// re-evaluated per Admin policy" has no automatic re-lock rule specified (spec §8 risk #2, still
// Open), so a full refund is the one paymentStatus value this gate explicitly excludes even when
// `status` alone would otherwise allow it; anything short of that is deliberately left to a manual
// Admin action rather than guessed at here.
@Injectable()
export class CustomerFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async loadAuthorizedOrder(orderId: string, customerId: bigint) {
    const order = await this.prisma.order.findFirst({ where: { id: BigInt(orderId), customerId } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (!statusAllowsFileAccess(order.status) || order.paymentStatus === 'refunded') {
      throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Payment for this order has not been confirmed');
    }
    return order;
  }

  async listAuthorizedFiles(orderId: string, customerId: bigint): Promise<AuthorizedFileDto[]> {
    const order = await this.loadAuthorizedOrder(orderId, customerId);
    const rows = await this.prisma.customerAuthorizedFile.findMany({ where: { orderId: order.id, customerId }, include: { designFile: true } });
    return rows.map((row) => toAuthorizedFileDto(row));
  }

  async requestDownload(orderId: string, fileId: string, customerId: bigint): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const order = await this.loadAuthorizedOrder(orderId, customerId);
    const row = await this.prisma.customerAuthorizedFile.findFirst({ where: { id: BigInt(fileId), orderId: order.id, customerId } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File not found or not authorized for this order');

    await this.checkAttemptLimit(row.id);
    const { token, expiresAt } = this.generateDownloadToken(fileId);
    await this.incrementDownload(row.id);
    return { downloadUrl: token, expiresAt };
  }

  // AC-6 — increments on every successful download and stamps first/last download timestamps.
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
