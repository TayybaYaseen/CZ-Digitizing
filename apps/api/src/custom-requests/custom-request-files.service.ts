import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { StorageService } from '../files/storage.service';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { toCustomRequestFileDto } from './dto/custom-request.dto';
import { assertValidCustomRequestTransition } from './custom-request-state-machine';

const DOWNLOAD_TOKEN_TTL_SECONDS = 10 * 60; // AC-5 — same 10-minute expiry as CustomerFilesService

// docs/specs/2026-08-28-12-custom-design-requests.md AC-5 — "never a raw/unauthenticated link";
// same private-file posture as CustomerFilesService (apps/api/src/files/customer-files.service.ts,
// aspect A-007), applied to a custom request's own deliverable files instead of a catalog Design's.
@Injectable()
export class CustomRequestFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
  ) {}

  // AC-5 — Admin uploads final files once production is done. Requires payment to already be
  // confirmed (paymentStatus completed) — never delivers work the customer hasn't paid for.
  async deliver(id: string, file: Express.Multer.File, admin: AccessTokenPayload) {
    const request = await this.prisma.customRequest.findUnique({ where: { id: BigInt(id) } });
    if (!request) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    if (request.paymentStatus !== 'completed') throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Payment for this custom request has not been confirmed');
    if (request.status !== 'ready' && request.status !== 'in_production') {
      throw new ApiException('INVALID_CUSTOM_REQUEST_TRANSITION', 409, 'Files can only be delivered once the request is in production or ready');
    }

    const hash = this.storage.hashContent(file.buffer);
    const storagePath = await this.storage.save(file.buffer, hash);
    const fileFormat = file.originalname.split('.').pop() ?? 'bin';

    await this.prisma.customRequestFile.create({
      data: {
        customRequestId: request.id,
        fileFormat,
        storagePath,
        fileSizeBytes: BigInt(file.size),
        uploadHash: hash,
        createdByAdminId: BigInt(admin.sub),
      },
    });

    const nextStatus = request.status === 'ready' ? 'delivered' : request.status;
    const updated = await this.prisma.customRequest.update({
      where: { id: request.id },
      data: nextStatus === 'delivered' ? { status: 'delivered', deliveredAt: new Date() } : {},
      include: { files: true },
    });

    await this.notifications.notify({
      recipientUserId: request.customerId.toString(),
      type: 'custom_request_status_update',
      title: 'Your files are ready',
      message: `The final files for your custom request #${request.requestNumber} are now available to download.`,
      relatedCustomRequestId: request.id.toString(),
      channels: ['email', 'in_app'],
    });

    return updated.files.map(toCustomRequestFileDto);
  }

  async requestDownload(id: string, fileId: string, customerId: bigint): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const request = await this.prisma.customRequest.findFirst({ where: { id: BigInt(id), customerId } });
    if (!request) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    if (request.status !== 'delivered' && request.status !== 'completed') {
      throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Files for this request have not been delivered yet');
    }

    const row = await this.prisma.customRequestFile.findFirst({ where: { id: BigInt(fileId), customRequestId: request.id } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File not found for this request');

    if (row.maxDownloadAttempts !== null && row.downloadCount >= row.maxDownloadAttempts) {
      throw new ApiException('FORBIDDEN', 403, 'Download-attempt limit reached for this file');
    }

    const now = new Date();
    await this.prisma.customRequestFile.update({
      where: { id: row.id },
      data: { downloadCount: { increment: 1 }, lastDownloadAt: now, firstDownloadAt: row.firstDownloadAt ?? now },
    });

    const { token, expiresAt } = this.storage.generateSignedToken(fileId, DOWNLOAD_TOKEN_TTL_SECONDS);
    return { downloadUrl: token, expiresAt };
  }

  // Marks the request completed once the customer has actually downloaded their files — AC-2's
  // last transition, distinct from AC-5's admin-side "delivered" so completion reflects real
  // customer action rather than an admin guess at when the customer is done.
  async markCompletedIfDelivered(id: string): Promise<void> {
    const request = await this.prisma.customRequest.findUnique({ where: { id: BigInt(id) } });
    if (!request || request.status !== 'delivered') return;
    assertValidCustomRequestTransition(request.status, 'completed');
    await this.prisma.customRequest.update({ where: { id: request.id }, data: { status: 'completed' } });
  }
}
