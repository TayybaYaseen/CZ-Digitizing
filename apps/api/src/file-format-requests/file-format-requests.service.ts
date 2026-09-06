import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { statusAllowsFileAccess } from '../orders/order-state-machine';
import { DesignFilesService } from '../files/design-files.service';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { toFileFormatRequestDto } from './dto/file-format-request.dto';
import type { CreateFileFormatRequestDto, FulfillFileFormatRequestDto } from './dto/file-format-request-write.dto';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-6 (aspect A-017a). Fulfillment reuses the
// existing private-file authorization pipeline (A-007) end to end — see this class's fulfill()
// doc comment for why no new download route is needed.
@Injectable()
export class FileFormatRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designFiles: DesignFilesService,
    private readonly notifications: NotificationService,
  ) {}

  async create(orderId: string, customerId: bigint, dto: CreateFileFormatRequestDto) {
    const order = await this.prisma.order.findFirst({ where: { id: BigInt(orderId), customerId } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (!statusAllowsFileAccess(order.status)) throw new ApiException('PAYMENT_NOT_CONFIRMED', 422, 'Payment for this order has not been confirmed');

    const row = await this.prisma.fileFormatRequest.create({
      data: { orderId: order.id, customerId, requestedFormat: dto.requestedFormat, notes: dto.notes },
    });

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'file_format_available',
        title: 'New file-format request',
        message: `Order #${order.id} has a new request for an additional "${dto.requestedFormat}" file.`,
        relatedOrderId: order.id.toString(),
        channels: ['email', 'in_app'],
      });
    }

    return toFileFormatRequestDto(row);
  }

  async listForOrder(orderId: string, customerId?: bigint) {
    const where = { orderId: BigInt(orderId), ...(customerId ? { customerId } : {}) };
    const rows = await this.prisma.fileFormatRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(toFileFormatRequestDto);
  }

  async listForAdmin() {
    const rows = await this.prisma.fileFormatRequest.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toFileFormatRequestDto);
  }

  // AC-6 — Admin uploads a new DesignFile in the requested format for the order's design (reusing
  // DesignFilesService.upload(), same validation/private-storage posture as any other catalog
  // file), then grants the customer access to it via a CustomerAuthorizedFile row — the exact same
  // record type/mechanism an order's original purchase creates (OrdersService.releaseFilesAndNotify).
  // The customer's download call is therefore the existing
  // POST /api/orders/:id/files/:fileId/download route; this module adds no download endpoint.
  async fulfill(id: string, file: Express.Multer.File, dto: FulfillFileFormatRequestDto, admin: AccessTokenPayload) {
    const request = await this.prisma.fileFormatRequest.findUnique({ where: { id: BigInt(id) } });
    if (!request) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'File format request not found');
    if (request.status === 'fulfilled') throw new ApiException('FILE_FORMAT_REQUEST_ALREADY_FULFILLED', 409, 'This request has already been fulfilled');

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: request.orderId }, include: { items: true } });
    const designId = dto.designId ?? order.items.find((item) => item.designId)?.designId?.toString();
    if (!designId) throw new ApiException('VALIDATION_ERROR', 400, 'No design on this order to attach the new file format to — pass designId explicitly');

    const [uploaded] = await this.designFiles.upload(designId, [file], admin);

    await this.prisma.customerAuthorizedFile.create({
      data: { orderId: order.id, customerId: request.customerId, designFileId: BigInt(uploaded.id) },
    });

    const updated = await this.prisma.fileFormatRequest.update({
      where: { id: request.id },
      data: { status: 'fulfilled', fulfilledFileId: BigInt(uploaded.id), fulfilledAt: new Date() },
    });

    await this.notifications.notify({
      recipientUserId: request.customerId.toString(),
      type: 'file_format_available',
      title: 'Your requested file format is ready',
      message: `The "${request.requestedFormat}" file you requested for order #${order.id} is now available to download.`,
      relatedOrderId: order.id.toString(),
      channels: ['email', 'in_app'],
    });

    return toFileFormatRequestDto(updated);
  }
}
