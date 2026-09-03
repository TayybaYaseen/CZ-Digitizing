import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { BundleQueryDto } from './dto/bundle-query.dto';
import { toBundleDetailDto, toBundleSummaryDto, type BundleDetailDto, type BundleSummaryDto } from './dto/bundle.dto';
import type { AddBundleDesignDto, CreateBundleDto, UpdateBundleDto } from './dto/bundle-write.dto';
import type { PagedResult } from '../designs/designs.service';

const BUNDLE_DETAIL_INCLUDE = {
  designs: { include: { design: true } },
} satisfies Prisma.DesignBundleInclude;

// docs/specs/2026-08-28-06-design-bundles.md §3/§4 (aspect A-008).
@Injectable()
export class BundlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // includeUnpublished — admin/freelancer/moderator managing bundles see drafts too (same
  // publishedOnlyFor()-gated pattern as DesignsService.list).
  async list(query: BundleQueryDto, includeUnpublished = false): Promise<PagedResult<BundleSummaryDto>> {
    const where: Prisma.DesignBundleWhereInput = { deletedAt: null, ...(includeUnpublished ? {} : { isPublished: true }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.designBundle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.designBundle.count({ where }),
    ]);
    return { items: rows.map(toBundleSummaryDto), total };
  }

  async get(id: string, includeUnpublished = false): Promise<BundleDetailDto> {
    const row = await this.prisma.designBundle.findFirst({
      where: { id: BigInt(id), deletedAt: null, ...(includeUnpublished ? {} : { isPublished: true }) },
      include: BUNDLE_DETAIL_INCLUDE,
    });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Bundle not found');
    return toBundleDetailDto(row);
  }

  async create(dto: CreateBundleDto, admin: AccessTokenPayload): Promise<BundleDetailDto> {
    const row = await this.prisma.designBundle.create({
      data: {
        name: dto.name,
        description: dto.description,
        previewImageUrl: dto.previewImageUrl,
        pricePkr: dto.pricePkr,
        salePricePkr: dto.salePricePkr,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
      include: BUNDLE_DETAIL_INCLUDE,
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'BUNDLE_CREATED',
      resourceType: 'design_bundle',
      resourceId: row.id.toString(),
      changes: { name: row.name },
    });

    return toBundleDetailDto(row);
  }

  async update(id: string, dto: UpdateBundleDto, admin: AccessTokenPayload): Promise<BundleDetailDto> {
    await this.findOrThrow(id);

    const row = await this.prisma.designBundle.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        description: dto.description,
        previewImageUrl: dto.previewImageUrl,
        pricePkr: dto.pricePkr,
        salePricePkr: dto.salePricePkr,
        isPublished: dto.isPublished,
      },
      include: BUNDLE_DETAIL_INCLUDE,
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'BUNDLE_UPDATED',
      resourceType: 'design_bundle',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });

    return toBundleDetailDto(row);
  }

  // Soft delete — AC-5: existing purchasers keep order history/file access after Admin unpublishes
  // or deletes a bundle, same reasoning as Design.remove().
  async remove(id: string, admin: AccessTokenPayload): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.designBundle.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date(), isPublished: false } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'BUNDLE_DELETED', resourceType: 'design_bundle', resourceId: id });
  }

  // AC-1/AC-7 — add a design to a bundle, with an optional per-design price override. Idempotent:
  // re-adding an already-included design updates its override rather than erroring (matches the
  // upsert posture of DesignsService.favorite()).
  async addDesign(bundleId: string, designId: string, dto: AddBundleDesignDto, admin: AccessTokenPayload): Promise<BundleDetailDto> {
    await this.findOrThrow(bundleId);
    const design = await this.prisma.design.findFirst({ where: { id: BigInt(designId), deletedAt: null } });
    if (!design) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Design not found');

    await this.prisma.bundleDesign.upsert({
      where: { bundleId_designId: { bundleId: BigInt(bundleId), designId: BigInt(designId) } },
      create: { bundleId: BigInt(bundleId), designId: BigInt(designId), priceOverridePkr: dto.priceOverridePkr },
      update: { priceOverridePkr: dto.priceOverridePkr },
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'BUNDLE_DESIGN_ADDED',
      resourceType: 'design_bundle',
      resourceId: bundleId,
      changes: { designId, priceOverridePkr: dto.priceOverridePkr },
    });

    return this.get(bundleId, true);
  }

  // AC-4 — removing a design from an already-published bundle must not retroactively revoke
  // access for customers who already purchased it. This only touches current bundle_designs
  // membership; existing customer_authorized_files rows (created by A-013 at payment_confirmed
  // time, from a snapshot of membership at purchase) are never re-derived from this table, so
  // removal here has no effect on past purchasers by construction.
  async removeDesign(bundleId: string, designId: string, admin: AccessTokenPayload): Promise<void> {
    await this.findOrThrow(bundleId);
    await this.prisma.bundleDesign.deleteMany({ where: { bundleId: BigInt(bundleId), designId: BigInt(designId) } });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'BUNDLE_DESIGN_REMOVED',
      resourceType: 'design_bundle',
      resourceId: bundleId,
      changes: { designId },
    });
  }

  // AC-7 — bundle total reflecting the sum of each included design's overridden price, rather
  // than the flat DesignBundle.pricePkr field, whenever any member has a priceOverridePkr set.
  async computeBundleTotal(bundleId: string): Promise<number> {
    const members = await this.prisma.bundleDesign.findMany({
      where: { bundleId: BigInt(bundleId) },
      include: { design: true },
    });
    return members.reduce((sum, m) => sum + Number(m.priceOverridePkr ?? m.design.pricePkr), 0);
  }

  // AC-3 — resolves every design's authorized-file target inside a bundle, from *current*
  // bundle_designs membership. TODO(A-013): Orders & Payment Processing (still Blocked per
  // docs/specs/SPEC_INDEX.md) must call this at payment_confirmed time and snapshot the result
  // into customer_authorized_files rows then — not re-derive it at download time — so that AC-4's
  // "no retroactive revocation" holds even after Admin later removes a design from the bundle.
  // Not wired to any order-creation path yet because no such path exists (CustomerFilesService
  // itself stubs every order-dependent method with a PAYMENT_NOT_CONFIRMED 422 for the same
  // reason). Returns every DesignFile id belonging to each currently-included design.
  async getAuthorizedFileTargets(bundleId: string): Promise<{ designId: string; fileId: string }[]> {
    const members = await this.prisma.bundleDesign.findMany({
      where: { bundleId: BigInt(bundleId) },
      include: { design: { include: { files: true } } },
    });
    return members.flatMap((m) => m.design.files.map((f) => ({ designId: m.designId.toString(), fileId: f.id.toString() })));
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.designBundle.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Bundle not found');
    return row;
  }
}
