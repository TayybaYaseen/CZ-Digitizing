import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toTestimonialDto } from './dto/testimonial.dto';
import type { CreateTestimonialDto, SubmitTestimonialDto, UpdateTestimonialDto } from './dto/testimonial-write.dto';

const MAX_HOME_COUNT = 6; // AC-4 — Home page shows max 6 initially, with View More.

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012c).
@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-4 — public listing: only published + approved. limit=home caps at MAX_HOME_COUNT.
  async list(scope: 'home' | 'all' = 'all') {
    const rows = await this.prisma.testimonial.findMany({
      where: { isPublished: true, moderationStatus: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: scope === 'home' ? MAX_HOME_COUNT : undefined,
    });
    return rows.map(toTestimonialDto);
  }

  // Admin view — every testimonial regardless of publish/moderation state.
  async listAdmin() {
    const rows = await this.prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toTestimonialDto);
  }

  async create(dto: CreateTestimonialDto, admin: AccessTokenPayload) {
    const row = await this.prisma.testimonial.create({
      data: {
        customerName: dto.customerName,
        country: dto.country,
        business: dto.business,
        photoUrl: dto.photoUrl,
        rating: dto.rating,
        feedback: dto.feedback,
        serviceUsed: dto.serviceUsed,
        isPublished: dto.isPublished ?? false,
        source: 'admin_curated',
        moderationStatus: 'approved',
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_CREATED', resourceType: 'testimonial', resourceId: row.id.toString() });
    return toTestimonialDto(row);
  }

  async update(id: string, dto: UpdateTestimonialDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.testimonial.update({
      where: { id: BigInt(id) },
      data: {
        customerName: dto.customerName,
        country: dto.country,
        business: dto.business,
        photoUrl: dto.photoUrl,
        rating: dto.rating,
        feedback: dto.feedback,
        serviceUsed: dto.serviceUsed,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_UPDATED', resourceType: 'testimonial', resourceId: id, changes: dto as Record<string, unknown> });
    return toTestimonialDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.testimonial.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_DELETED', resourceType: 'testimonial', resourceId: id });
  }

  // AC-7 — requires the order to belong to the caller and be in a completed state; stored pending
  // moderation, unpublished, until Admin approves.
  async submit(dto: SubmitTestimonialDto, customerId: bigint) {
    const order = await this.prisma.order.findFirst({ where: { id: BigInt(dto.orderId), customerId } });
    if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
    if (order.status !== 'completed') throw new ApiException('ORDER_NOT_ELIGIBLE_FOR_REVIEW', 409, 'Only completed orders can be reviewed');

    const customer = await this.prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    const row = await this.prisma.testimonial.create({
      data: {
        customerName: customer.displayName ?? customer.username ?? customer.email,
        country: 'Not specified',
        rating: dto.rating,
        feedback: dto.feedback,
        serviceUsed: dto.serviceUsed,
        isPublished: false,
        source: 'customer_submitted',
        moderationStatus: 'pending',
        customerId,
        orderId: order.id,
      },
    });
    return toTestimonialDto(row);
  }

  // AC-7 — Admin approve/reject a customer-submitted review; approving publishes it.
  async moderate(id: string, decision: 'approved' | 'rejected', admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.testimonial.update({
      where: { id: BigInt(id) },
      data: { moderationStatus: decision, isPublished: decision === 'approved' },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_MODERATED', resourceType: 'testimonial', resourceId: id, changes: { decision } });
    return toTestimonialDto(row);
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.testimonial.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Testimonial not found');
    return row;
  }
}
