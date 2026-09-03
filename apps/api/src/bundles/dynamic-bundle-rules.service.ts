import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toDynamicBundleRuleDto, type CreateDynamicBundleRuleDto, type DynamicBundleRuleDto, type UpdateDynamicBundleRuleDto } from './dto/dynamic-bundle-rule.dto';

// AC-6 — "any N designs from Category X for Y PKR" dynamic bundle rules. CRUD only: automatic
// application at checkout ("customer selects qualifying designs, dynamic price applies instead of
// the sum of individual prices") is inherently a cart-total computation — TODO(A-011): Shopping
// Cart & Checkout, still Blocked per docs/specs/SPEC_INDEX.md, must read published rules from here
// and apply one when a cart's selected designs satisfy requiredDesignCount for a category.
@Injectable()
export class DynamicBundleRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(includeUnpublished = false): Promise<DynamicBundleRuleDto[]> {
    const rows = await this.prisma.dynamicBundleRule.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDynamicBundleRuleDto);
  }

  async create(dto: CreateDynamicBundleRuleDto, admin: AccessTokenPayload): Promise<DynamicBundleRuleDto> {
    const row = await this.prisma.dynamicBundleRule.create({
      data: {
        name: dto.name,
        categoryId: BigInt(dto.categoryId),
        requiredDesignCount: dto.requiredDesignCount,
        bundlePricePkr: dto.bundlePricePkr,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DYNAMIC_BUNDLE_RULE_CREATED',
      resourceType: 'dynamic_bundle_rule',
      resourceId: row.id.toString(),
      changes: { name: row.name },
    });
    return toDynamicBundleRuleDto(row);
  }

  async update(id: string, dto: UpdateDynamicBundleRuleDto, admin: AccessTokenPayload): Promise<DynamicBundleRuleDto> {
    await this.findOrThrow(id);
    const row = await this.prisma.dynamicBundleRule.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        categoryId: dto.categoryId ? BigInt(dto.categoryId) : undefined,
        requiredDesignCount: dto.requiredDesignCount,
        bundlePricePkr: dto.bundlePricePkr,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DYNAMIC_BUNDLE_RULE_UPDATED',
      resourceType: 'dynamic_bundle_rule',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });
    return toDynamicBundleRuleDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.dynamicBundleRule.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'DYNAMIC_BUNDLE_RULE_DELETED', resourceType: 'dynamic_bundle_rule', resourceId: id });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.dynamicBundleRule.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Dynamic bundle rule not found');
    return row;
  }
}
