import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { ApiException } from '../common/exceptions/api-exception';
import { parseIdOr404 } from '../common/parse-id.util';
import type { Order, Prisma } from '../generated/prisma';
import { orderAllowsFileAccess } from '../orders/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { toAuthorizedFileDto, type AuthorizedFileDto } from './dto/customer-authorized-file.dto';
import { isEmbFormat, NOT_EMB_FILE } from './emb-policy';
import { StorageService } from './storage.service';

const DOWNLOAD_TOKEN_TTL_SECONDS = 10 * 60; // AC-4 — 10-minute expiry

// docs/specs/2026-08-28-05-private-file-management.md §4 (aspect A-007, AC-4/5/6/8/9/11), wired to
// a real Order per docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013).
//
// A-013 FINAL PAYMENT ACCESS POLICY — the gate is `orderAllowsFileAccess` (order-state-machine.ts): files
// are reachable ONLY while the order is 100% paid and confirmed by an admin (paymentStatus
// 'completed', status payment_confirmed/processing/ready/completed) and NO refund has been recorded.
// Unpaid, partially paid, receipt-pending/rejected, cancelled, partially refunded and fully refunded
// orders all answer 422 PAYMENT_NOT_CONFIRMED — enforced here on every request, from the database's
// own order row, so nothing the client sends (or a stale token, URL or replayed request) can change
// the outcome. Status stays valid through processing/ready/completed (AC-6), not just the instant of
// confirmation.
//
// Two ways to own an order, one gate: a signed-in customer (order.customerId) or a guest browser
// (order.guestAccessKeyHash = SHA-256 of its czd_guest_orders cookie). Both resolve the order with
// the owner condition in the same query as the id — a wrong owner is indistinguishable from a
// missing order (404) — and then go through exactly the same payment gate, .EMB exclusion (AC-1)
// and download-attempt limit.
@Injectable()
export class CustomerFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  private async loadAuthorizedOrder(orderId: string, owner: Prisma.OrderWhereInput): Promise<Order> {
    const order = await this.prisma.order.findFirst({ where: { id: parseIdOr404(orderId, 'Order'), ...owner } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (!orderAllowsFileAccess(order)) {
      throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Files are available only once this order has been paid in full and the payment confirmed');
    }
    return order;
  }

  async listAuthorizedFiles(orderId: string, customerId: bigint): Promise<AuthorizedFileDto[]> {
    return this.listFor(await this.loadAuthorizedOrder(orderId, { customerId }));
  }

  async requestDownload(orderId: string, fileId: string, customerId: bigint): Promise<{ downloadUrl: string; expiresAt: Date }> {
    return this.downloadFor(await this.loadAuthorizedOrder(orderId, { customerId }), fileId);
  }

  // Guest checkout — the caller has already turned the cookie into its hash; a null hash (no cookie
  // or a malformed one) can never match an order.
  async listAuthorizedFilesForGuest(orderId: string, guestAccessKeyHash: string | null): Promise<AuthorizedFileDto[]> {
    return this.listFor(await this.loadAuthorizedOrder(orderId, this.guestOwner(guestAccessKeyHash)));
  }

  async requestDownloadForGuest(orderId: string, fileId: string, guestAccessKeyHash: string | null): Promise<{ downloadUrl: string; expiresAt: Date }> {
    return this.downloadFor(await this.loadAuthorizedOrder(orderId, this.guestOwner(guestAccessKeyHash)), fileId);
  }

  private guestOwner(guestAccessKeyHash: string | null): Prisma.OrderWhereInput {
    if (!guestAccessKeyHash) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    return { guestAccessKeyHash };
  }

  private async listFor(order: Order): Promise<AuthorizedFileDto[]> {
    const rows = await this.prisma.customerAuthorizedFile.findMany({
      where: { orderId: order.id, customerId: order.customerId, designFile: NOT_EMB_FILE },
      include: { designFile: true },
    });
    return rows.map((row) => toAuthorizedFileDto(row));
  }

  private async downloadFor(order: Order, fileId: string): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const row = await this.prisma.customerAuthorizedFile.findFirst({
      where: { id: parseIdOr404(fileId, 'File'), orderId: order.id, customerId: order.customerId },
      include: { designFile: { select: { fileFormat: true } } },
    });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File not found or not authorized for this order');
    if (isEmbFormat(row.designFile.fileFormat)) throw new ApiException('FILE_FORMAT_BLOCKED', 422, '.EMB files are never available for download');

    await this.checkAttemptLimit(row.id);
    const { token, expiresAt } = this.generateDownloadToken(fileId);
    const newCount = await this.incrementDownload(row.id);

    // AC-12/AC-15 — keyed on the post-increment count (same "resulting-state nonce" pattern
    // ActivityService callers use elsewhere in this pass): a genuine repeat download strictly
    // advances downloadCount each time, so it gets its own event; a network-level retry of the
    // exact same download request lands on the same resulting count and collapses.
    await this.activity.record({
      customerId: order.customerId,
      eventType: 'DOWNLOADED',
      orderId: order.id,
      fileId: row.designFileId,
      source: 'web',
      idempotencyKey: `${order.customerId}:DOWNLOADED:${row.id}:${newCount}`,
    });

    return { downloadUrl: token, expiresAt };
  }

  // AC-6 — increments on every successful download and stamps first/last download timestamps.
  async incrementDownload(authorizedFileId: bigint): Promise<number> {
    const now = new Date();
    const existing = await this.prisma.customerAuthorizedFile.findUniqueOrThrow({ where: { id: authorizedFileId } });
    const updated = await this.prisma.customerAuthorizedFile.update({
      where: { id: authorizedFileId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadAt: now,
        firstDownloadAt: existing.firstDownloadAt ?? now,
      },
    });
    return updated.downloadCount;
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
