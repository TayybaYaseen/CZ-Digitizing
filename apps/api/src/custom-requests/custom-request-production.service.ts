import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { StorageService } from '../files/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toCustomRequestProductionFileDto,
  toCustomRequestTaskDto,
  toCustomRequestTimeEntryDto,
} from './dto/custom-request.dto';
import type {
  CreateCustomRequestProductionFileDto,
  CreateCustomRequestTaskDto,
  CreateCustomRequestTimeEntryDto,
  UpdateCustomRequestTaskDto,
} from './dto/custom-request-write.dto';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-9 (aspect A-017) — designer production
// tooling: task checklist, time tracking, file-versioning during production. Kept as its own
// service (rather than folded into CustomRequestsService) the same way CustomRequestFilesService
// already is — a distinct sub-concern of the same aspect, not a new one.
//
// Every method here just needs "the request exists"; unlike CustomRequestFilesService.deliver()
// (which gates on payment/status because it's the customer-facing deliverable), this internal
// tooling has no such gate — a designer can build a checklist or log time from the moment a
// request is assigned, before any quote/payment has happened.
@Injectable()
export class CustomRequestProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // --- Tasks -----------------------------------------------------------------------------------

  async listTasks(id: string) {
    await this.findRequestOrThrow(id);
    const rows = await this.prisma.customRequestTask.findMany({
      where: { customRequestId: BigInt(id) },
      include: { createdBy: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toCustomRequestTaskDto);
  }

  async createTask(id: string, dto: CreateCustomRequestTaskDto, staff: AccessTokenPayload) {
    const request = await this.findRequestOrThrow(id);
    const last = await this.prisma.customRequestTask.findFirst({
      where: { customRequestId: request.id },
      orderBy: { sortOrder: 'desc' },
    });
    const row = await this.prisma.customRequestTask.create({
      data: {
        customRequestId: request.id,
        title: dto.title,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdByUserId: BigInt(staff.sub),
      },
      include: { createdBy: true },
    });
    return toCustomRequestTaskDto(row);
  }

  async updateTask(id: string, taskId: string, dto: UpdateCustomRequestTaskDto) {
    await this.findRequestOrThrow(id);
    const existing = await this.findTaskOrThrow(id, taskId);
    const wasDone = existing.done;
    const nowDone = dto.done ?? existing.done;
    const row = await this.prisma.customRequestTask.update({
      where: { id: existing.id },
      data: {
        title: dto.title ?? existing.title,
        done: nowDone,
        completedAt: !wasDone && nowDone ? new Date() : wasDone && !nowDone ? null : existing.completedAt,
      },
      include: { createdBy: true },
    });
    return toCustomRequestTaskDto(row);
  }

  async deleteTask(id: string, taskId: string): Promise<void> {
    await this.findRequestOrThrow(id);
    const existing = await this.findTaskOrThrow(id, taskId);
    await this.prisma.customRequestTask.delete({ where: { id: existing.id } });
  }

  // --- Time entries ------------------------------------------------------------------------------

  async listTimeEntries(id: string) {
    await this.findRequestOrThrow(id);
    const rows = await this.prisma.customRequestTimeEntry.findMany({
      where: { customRequestId: BigInt(id) },
      include: { designer: true },
      orderBy: { createdAt: 'desc' },
    });
    return { entries: rows.map(toCustomRequestTimeEntryDto), totalMinutes: rows.reduce((sum, r) => sum + r.minutes, 0) };
  }

  async logTime(id: string, dto: CreateCustomRequestTimeEntryDto, staff: AccessTokenPayload) {
    const request = await this.findRequestOrThrow(id);
    const row = await this.prisma.customRequestTimeEntry.create({
      data: { customRequestId: request.id, designerId: BigInt(staff.sub), minutes: dto.minutes, note: dto.note },
      include: { designer: true },
    });
    return toCustomRequestTimeEntryDto(row);
  }

  async deleteTimeEntry(id: string, entryId: string): Promise<void> {
    await this.findRequestOrThrow(id);
    const row = await this.prisma.customRequestTimeEntry.findFirst({ where: { id: BigInt(entryId), customRequestId: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Time entry not found for this request');
    await this.prisma.customRequestTimeEntry.delete({ where: { id: row.id } });
  }

  // --- Production files (versioned, internal-only) ------------------------------------------------

  async listProductionFiles(id: string) {
    await this.findRequestOrThrow(id);
    const rows = await this.prisma.customRequestProductionFile.findMany({
      where: { customRequestId: BigInt(id) },
      include: { uploadedBy: true },
      orderBy: { version: 'desc' },
    });
    return rows.map(toCustomRequestProductionFileDto);
  }

  async uploadProductionFile(id: string, file: Express.Multer.File, dto: CreateCustomRequestProductionFileDto, staff: AccessTokenPayload) {
    if (!file) throw new ApiException('VALIDATION_ERROR', 400, 'A file is required');
    const request = await this.findRequestOrThrow(id);
    const last = await this.prisma.customRequestProductionFile.findFirst({
      where: { customRequestId: request.id },
      orderBy: { version: 'desc' },
    });

    const hash = this.storage.hashContent(file.buffer);
    const storagePath = await this.storage.save(file.buffer, hash);
    const fileFormat = file.originalname.split('.').pop() ?? 'bin';

    const row = await this.prisma.customRequestProductionFile.create({
      data: {
        customRequestId: request.id,
        version: (last?.version ?? 0) + 1,
        fileFormat,
        storagePath,
        fileSizeBytes: BigInt(file.size),
        uploadHash: hash,
        note: dto.note,
        uploadedByUserId: BigInt(staff.sub),
      },
      include: { uploadedBy: true },
    });
    return toCustomRequestProductionFileDto(row);
  }

  // Internal-only file — streamed directly to an already-role/permission-gated staff caller
  // (CustomRequestsController), unlike AC-5's customer-facing CustomRequestFile which goes through
  // StorageService's signed-token flow. No customer ever reaches this method.
  async readProductionFileForDownload(id: string, fileId: string): Promise<{ buffer: Buffer; fileFormat: string; version: number }> {
    const row = await this.prisma.customRequestProductionFile.findFirst({ where: { id: BigInt(fileId), customRequestId: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Production file not found for this request');
    const buffer = await this.storage.read(row.storagePath);
    return { buffer, fileFormat: row.fileFormat, version: row.version };
  }

  private async findRequestOrThrow(id: string) {
    const row = await this.prisma.customRequest.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    return row;
  }

  private async findTaskOrThrow(customRequestId: string, taskId: string) {
    const row = await this.prisma.customRequestTask.findFirst({ where: { id: BigInt(taskId), customRequestId: BigInt(customRequestId) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Task not found for this request');
    return row;
  }
}
