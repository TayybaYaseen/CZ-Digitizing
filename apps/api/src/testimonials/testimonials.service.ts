import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReviewEligibilityDto, ReviewableItemDto } from '@czd/shared-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { parseIdOr404 } from '../common/parse-id.util';
import type { Env } from '../config/env.validation';
import type { Prisma } from '../generated/prisma';
import { DEFAULT_CHANNELS } from '../notifications/notifications.constants';
import { NotificationService } from '../notifications/services/notification.service';
import { orderAllowsFileAccess } from '../orders/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { toAdminTestimonialDto, toMyTestimonialDto, toPublicTestimonialDto } from './dto/testimonial.dto';
import type { CreateTestimonialDto, SubmitTestimonialDto, UpdateTestimonialDto } from './dto/testimonial-write.dto';
import { ReviewImageService } from './review-image.service';
import { deriveTestimonialStatus, normalizeForDuplicateCheck } from './review-text.util';
import { DUPLICATE_REVIEW_WINDOW_HOURS, MAX_HOME_COUNT, MAX_PENDING_REVIEWS_PER_CUSTOMER } from './testimonials.constants';

type UploadedImage = { buffer: Buffer; originalname?: string };

const PUBLIC_WHERE = { isPublished: true, moderationStatus: 'approved' } as const;
const RELATIONS = { customer: { select: { email: true } }, customRequest: { select: { requestNumber: true } } } satisfies Prisma.TestimonialInclude;

// §6 (D1) — an order counts once it is fully paid, admin-confirmed and not refunded (the A-013 file
// unlock rule); a custom request once it is delivered or completed.
const PAID_ORDER_STATUSES = ['payment_confirmed', 'processing', 'ready', 'completed'] as const;
const REVIEWABLE_CUSTOM_REQUEST_STATUSES = ['delivered', 'completed'] as const;
const CUSTOM_REQUEST_SERVICE_HINT: Record<string, string> = {
  embroidery_custom: 'Embroidery Digitizing',
  vector_custom: 'Vector Art',
};

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012c), extended by
// docs/specs/2026-10-06-22-customer-review-submission.md (aspect A-026): customer submission with an
// optional private image, the Pending/Published/Hidden/Rejected moderation model, My Reviews.
@Injectable()
export class TestimonialsService {
  private readonly logger = new Logger(TestimonialsService.name);
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationService,
    private readonly images: ReviewImageService,
    config: ConfigService<Env, true>,
  ) {
    this.apiBaseUrl = config.get('API_BASE_URL', { infer: true });
  }

  // ── Public ────────────────────────────────────────────────────────────────────────────────────

  // A-012c AC-4 / A-026 §14 — only published + approved, narrowed to the public DTO.
  async list(scope: 'home' | 'all' = 'all') {
    const rows = await this.prisma.testimonial.findMany({
      where: PUBLIC_WHERE,
      orderBy: { createdAt: 'desc' },
      take: scope === 'home' ? MAX_HOME_COUNT : undefined,
    });
    return rows.map((row) => toPublicTestimonialDto(row, this.apiBaseUrl));
  }

  // §8 — the public image route serves ONLY a published review's image; anything else is a 404.
  async getPublicImage(id: string) {
    const row = await this.prisma.testimonial.findFirst({ where: { id: parseIdOr404(id, 'Image'), ...PUBLIC_WHERE } });
    return this.readImageOr404(row);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────────────────────

  // Every testimonial, both sources, every status — the moderation queue filters client-side (§13).
  async listAdmin() {
    const rows = await this.prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' }, include: RELATIONS });
    return rows.map(toAdminTestimonialDto);
  }

  async getAdminImage(id: string) {
    return this.readImageOr404(await this.findOrThrow(id));
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
      include: RELATIONS,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_CREATED', resourceType: 'testimonial', resourceId: row.id.toString() });
    return toAdminTestimonialDto(row);
  }

  // §16 — edit never changes status; publishing through here is only allowed for approved rows (§10).
  async update(id: string, dto: UpdateTestimonialDto, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    if (dto.isPublished === true && existing.moderationStatus !== 'approved') {
      throw new ApiException('INVALID_REVIEW_TRANSITION', 409, 'Only an approved review can be published — approve it first');
    }
    const row = await this.prisma.testimonial.update({
      where: { id: existing.id },
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
      include: RELATIONS,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_UPDATED', resourceType: 'testimonial', resourceId: id, changes: dto as Record<string, unknown> });
    return toAdminTestimonialDto(row);
  }

  // §12 — permanent delete (D7), plus the private image file once nothing references it.
  async remove(id: string, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    await this.prisma.testimonial.delete({ where: { id: existing.id } });
    await this.images.deleteIfUnreferenced(existing.imageStoragePath);
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_DELETED', resourceType: 'testimonial', resourceId: id });
  }

  // A-012c AC-7 / A-026 §10 — Approve (→ Published) from Pending or Rejected; Reject (→ Rejected)
  // from Pending only. Anything else is INVALID_REVIEW_TRANSITION.
  async moderate(id: string, decision: 'approved' | 'rejected', admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    const status = deriveTestimonialStatus(existing);
    const allowed = decision === 'approved' ? status === 'pending' || status === 'rejected' : status === 'pending';
    if (!allowed) {
      throw new ApiException('INVALID_REVIEW_TRANSITION', 409, `A ${status} review cannot be ${decision === 'approved' ? 'approved' : 'rejected'}`);
    }
    const row = await this.prisma.testimonial.update({
      where: { id: existing.id },
      data: { moderationStatus: decision, isPublished: decision === 'approved' },
      include: RELATIONS,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_MODERATED', resourceType: 'testimonial', resourceId: id, changes: { decision } });
    return toAdminTestimonialDto(row);
  }

  // §10/§12 — Hide (Published → Hidden) / Unhide (Hidden → Published). Approved rows only.
  async setVisibility(id: string, isPublished: boolean, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    const status = deriveTestimonialStatus(existing);
    if (status !== (isPublished ? 'hidden' : 'published')) {
      throw new ApiException('INVALID_REVIEW_TRANSITION', 409, `A ${status} review cannot be ${isPublished ? 'unhidden' : 'hidden'}`);
    }
    const row = await this.prisma.testimonial.update({ where: { id: existing.id }, data: { isPublished }, include: RELATIONS });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: isPublished ? 'TESTIMONIAL_UNHIDDEN' : 'TESTIMONIAL_HIDDEN',
      resourceType: 'testimonial',
      resourceId: id,
    });
    return toAdminTestimonialDto(row);
  }

  // §11/§15 — Admin replaces (or adds) the image on any review, through the same pipeline.
  async replaceImage(id: string, file: UploadedImage | undefined, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    if (!file) throw new ApiException('VALIDATION_ERROR', 400, 'An image file is required', [{ field: 'image', message: 'required' }]);
    const stored = await this.images.process(file);
    const row = await this.prisma.testimonial.update({ where: { id: existing.id }, data: stored, include: RELATIONS });
    if (existing.imageStoragePath !== stored.imageStoragePath) await this.images.deleteIfUnreferenced(existing.imageStoragePath);
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_IMAGE_REPLACED', resourceType: 'testimonial', resourceId: id });
    return toAdminTestimonialDto(row);
  }

  async removeImage(id: string, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    const row = await this.prisma.testimonial.update({
      where: { id: existing.id },
      data: { imageStoragePath: null, imageContentType: null, imageOriginalFilename: null },
      include: RELATIONS,
    });
    await this.images.deleteIfUnreferenced(existing.imageStoragePath);
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TESTIMONIAL_IMAGE_REMOVED', resourceType: 'testimonial', resourceId: id });
    return toAdminTestimonialDto(row);
  }

  // ── Customer ──────────────────────────────────────────────────────────────────────────────────

  // §6 — what the Write a Review form needs: whether the caller may review, which items they can
  // link, how many reviews are pending, and a display-name suggestion (never the email).
  async eligibility(customerId: bigint): Promise<ReviewEligibilityDto> {
    const [items, pendingCount, user] = await Promise.all([
      this.reviewableItems(customerId),
      this.prisma.testimonial.count({ where: { customerId, moderationStatus: 'pending' } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: customerId }, select: { displayName: true, username: true } }),
    ]);
    return {
      eligible: items.length > 0,
      items,
      pendingCount,
      pendingLimit: MAX_PENDING_REVIEWS_PER_CUSTOMER,
      suggestedDisplayName: user.displayName ?? user.username ?? null,
    };
  }

  // §6/§7/§18 — always stored Pending + unpublished; the image (if any) goes to private storage.
  async submit(dto: SubmitTestimonialDto, customerId: bigint, image?: UploadedImage) {
    if (dto.orderId && dto.customRequestId) {
      throw new ApiException('VALIDATION_ERROR', 400, 'Link a review to an order or a custom request, not both', [{ field: 'orderId', message: 'only one link allowed' }]);
    }

    const items = await this.reviewableItems(customerId);
    if (items.length === 0) throw new ApiException('NOT_ELIGIBLE_TO_REVIEW', 403, 'You can write a review once you have a paid order or a delivered custom request');

    let orderId: bigint | null = null;
    let customRequestId: bigint | null = null;
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: BigInt(dto.orderId), customerId } });
      // Not found rather than forbidden — never confirm another customer's order exists.
      if (!order) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Order not found');
      if (!orderAllowsFileAccess(order)) throw new ApiException('ORDER_NOT_ELIGIBLE_FOR_REVIEW', 409, 'Only fully paid orders can be reviewed');
      orderId = order.id;
    }
    if (dto.customRequestId) {
      const request = await this.prisma.customRequest.findFirst({ where: { id: BigInt(dto.customRequestId), customerId } });
      if (!request) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
      if (!(REVIEWABLE_CUSTOM_REQUEST_STATUSES as readonly string[]).includes(request.status)) {
        throw new ApiException('NOT_ELIGIBLE_TO_REVIEW', 403, 'Only delivered custom requests can be reviewed');
      }
      customRequestId = request.id;
    }
    if (orderId || customRequestId) {
      const already = await this.prisma.testimonial.count({ where: orderId ? { orderId } : { customRequestId } });
      if (already > 0) throw new ApiException('ALREADY_REVIEWED', 409, 'You have already reviewed this');
    }

    const pending = await this.prisma.testimonial.count({ where: { customerId, moderationStatus: 'pending' } });
    if (pending >= MAX_PENDING_REVIEWS_PER_CUSTOMER) {
      throw new ApiException('TOO_MANY_PENDING_REVIEWS', 409, 'You have reviews waiting for approval — please wait until they are reviewed');
    }

    const since = new Date(Date.now() - DUPLICATE_REVIEW_WINDOW_HOURS * 3600 * 1000);
    const recent = await this.prisma.testimonial.findMany({ where: { customerId, createdAt: { gte: since } }, select: { originalFeedback: true, feedback: true } });
    const normalized = normalizeForDuplicateCheck(dto.feedback);
    if (recent.some((r) => normalizeForDuplicateCheck(r.originalFeedback ?? r.feedback) === normalized)) {
      throw new ApiException('DUPLICATE_REVIEW', 409, 'You already submitted this review');
    }

    // D-a — the public name is what the customer typed, else their profile name; never the email.
    let customerName = dto.customerName;
    if (!customerName) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customerId }, select: { displayName: true, username: true } });
      customerName = user.displayName ?? user.username ?? undefined;
      if (!customerName) throw new ApiException('VALIDATION_ERROR', 400, 'A display name is required', [{ field: 'customerName', message: 'required' }]);
    }

    // Image is processed (and validated) only after every cheap check passed.
    const stored = image ? await this.images.process(image) : null;

    const row = await this.prisma.testimonial.create({
      data: {
        customerName,
        country: dto.country ?? null,
        rating: dto.rating,
        feedback: dto.feedback,
        originalFeedback: dto.feedback,
        serviceUsed: dto.serviceUsed,
        isPublished: false,
        source: 'customer_submitted',
        moderationStatus: 'pending',
        customerId,
        orderId,
        customRequestId,
        ...(stored ?? {}),
      },
      include: RELATIONS,
    });

    await this.notifyAdminsOfSubmission(customerName, dto.rating);
    return toMyTestimonialDto(row);
  }

  async listMine(customerId: bigint) {
    const rows = await this.prisma.testimonial.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, include: RELATIONS });
    return rows.map(toMyTestimonialDto);
  }

  async getMyImage(id: string, customerId: bigint) {
    const row = await this.prisma.testimonial.findFirst({ where: { id: parseIdOr404(id, 'Image'), customerId } });
    return this.readImageOr404(row);
  }

  // §21 (D4) — withdraw = permanent delete of the caller's own review, any status.
  async withdraw(id: string, customerId: bigint) {
    const row = await this.prisma.testimonial.findFirst({ where: { id: parseIdOr404(id, 'Review'), customerId } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Review not found');
    await this.prisma.testimonial.delete({ where: { id: row.id } });
    await this.images.deleteIfUnreferenced(row.imageStoragePath);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────────────────────

  private async reviewableItems(customerId: bigint): Promise<ReviewableItemDto[]> {
    const [orders, requests] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId, paymentStatus: 'completed', status: { in: [...PAID_ORDER_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { take: 1, include: { design: { select: { name: true } }, bundle: { select: { name: true } } } },
          testimonials: { select: { id: true }, take: 1 },
        },
      }),
      this.prisma.customRequest.findMany({
        where: { customerId, status: { in: [...REVIEWABLE_CUSTOM_REQUEST_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        include: { testimonials: { select: { id: true }, take: 1 } },
      }),
    ]);

    const orderItems: ReviewableItemDto[] = orders.filter(orderAllowsFileAccess).map((order) => {
      const first = order.items[0];
      return {
        kind: 'order',
        id: order.id.toString(),
        reference: `#${order.id}`,
        serviceHint: first?.design?.name ?? first?.bundle?.name ?? first?.customDescription ?? null,
        alreadyReviewed: order.testimonials.length > 0,
      };
    });
    const requestItems: ReviewableItemDto[] = requests.map((request) => ({
      kind: 'custom_request',
      id: request.id.toString(),
      reference: request.requestNumber,
      serviceHint: CUSTOM_REQUEST_SERVICE_HINT[request.requestType] ?? null,
      alreadyReviewed: request.testimonials.length > 0,
    }));
    return [...orderItems, ...requestItems];
  }

  // §20 — every admin, Dashboard + email. The review text is deliberately not included.
  private async notifyAdminsOfSubmission(displayName: string, rating: number): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
      for (const admin of admins) {
        await this.notifications.notify({
          recipientUserId: admin.id.toString(),
          type: 'review_submitted',
          title: 'New customer review submitted',
          message: `${displayName} left a ${rating}★ review. It is waiting for moderation.`,
          channels: DEFAULT_CHANNELS.review_submitted,
        });
      }
    } catch (err) {
      // The review is already saved; a notification failure must not fail the customer's submit.
      this.logger.error(`review_submitted notification failed: ${(err as Error).message}`);
    }
  }

  private async readImageOr404(row: { id: bigint; imageStoragePath: string | null; imageContentType: string | null } | null) {
    if (!row?.imageStoragePath || !row.imageContentType) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Image not found');
    try {
      return { buffer: await this.images.read(row.imageStoragePath), contentType: row.imageContentType, filename: `review-${row.id}.webp` };
    } catch {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Image not found');
    }
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.testimonial.findUnique({ where: { id: parseIdOr404(id, 'Testimonial') } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Testimonial not found');
    return row;
  }
}
