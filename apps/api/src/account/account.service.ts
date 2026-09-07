import { Injectable } from '@nestjs/common';
import { toUserProfileDto, type UserProfileDto } from '../auth/dto/user-profile.dto';
import { ApiException } from '../common/exceptions/api-exception';
import { ImageUploadService } from '../designs/image-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { PurchasedDesignDto } from './dto/purchased-design.dto';
import { toAccountMemberDto, type AccountMemberDto } from './dto/account-member.dto';

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019). Pure aggregation/
// composition layer over other features' own data — see this file's individual methods for which
// spec each delegated read actually belongs to.
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageUpload: ImageUploadService,
  ) {}

  async getProfile(customerId: bigint): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    return toUserProfileDto(user);
  }

  // AC-14 — lets Admin find the customer whose activity/history they want to look up. Minimal by
  // design: email search + pagination, matching this codebase's other simple admin list patterns
  // (e.g. FreelancerAccountsService) rather than a full customer-CRM feature, which no AC in this
  // spec actually asks for.
  async adminListCustomers(search: string | undefined, page: number, pageSize: number) {
    const where = { role: 'customer' as const, ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toUserProfileDto), total };
  }

  // AC-3 — updates only the users row; every historical quotes.customer_name/order/custom-request
  // record keeps whatever identity info it captured at submission time, untouched by construction
  // (this method never writes to those tables).
  async updateProfile(customerId: bigint, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({ where: { id: customerId }, data: { displayName: dto.displayName } });
    return toUserProfileDto(user);
  }

  async updateAvatar(customerId: bigint, file: Express.Multer.File): Promise<UserProfileDto> {
    const { url } = await this.imageUpload.saveImage(file);
    const user = await this.prisma.user.update({ where: { id: customerId }, data: { avatarUrl: url } });
    return toUserProfileDto(user);
  }

  // AC-2 — unions individual-design and bundle purchases across every order the customer has ever
  // placed, de-duplicated per design/bundle (a design bought in two separate orders is one row with
  // two `purchases` entries). Only order items belonging to orders that actually reached a state
  // where files would be released are meaningful here — but per AC-1's "every order they've ever
  // placed" posture for the parallel My Orders view, this deliberately does NOT filter by payment
  // status: a still-pending order's items appear too, same as My Orders would show them, since
  // "purchased" in this table means "the customer's order contains this line item", not "already
  // downloadable" (that gate lives entirely in the Private File Management endpoint this DTO points
  // the frontend at — see purchased-design.dto.ts's own comment).
  async listPurchasedDesigns(customerId: bigint): Promise<PurchasedDesignDto[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { customerId }, OR: [{ designId: { not: null } }, { bundleId: { not: null } }] },
      include: {
        order: { select: { id: true, createdAt: true } },
        design: { select: { id: true, name: true, previewImageUrl: true } },
        bundle: { select: { id: true, name: true, previewImageUrl: true } },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    const byKey = new Map<string, PurchasedDesignDto>();
    for (const item of items) {
      const isDesign = item.design !== null;
      const target = isDesign ? item.design! : item.bundle!;
      const key = `${isDesign ? 'design' : 'bundle'}:${target.id}`;
      const purchase = { orderId: item.order.id.toString(), purchasedAt: item.order.createdAt.toISOString() };

      const existing = byKey.get(key);
      if (existing) {
        existing.purchases.push(purchase);
      } else {
        byKey.set(key, {
          type: isDesign ? 'design' : 'bundle',
          id: target.id.toString(),
          name: target.name,
          previewImageUrl: target.previewImageUrl,
          purchases: [purchase],
        });
      }
    }
    return Array.from(byKey.values());
  }

  // AC-7 — the "effective" customer id whose shared history a request should read: a secondary
  // member sees the primary account's orders/quotes/custom-requests/purchased-designs/activity,
  // not their own empty history. A user who is both a primary (has invited others) and never
  // themselves been invited simply reads their own id, unchanged.
  //
  // Deliberately the minimal-viable reading of AC-7, not a full invite-token/accept-by-link flow:
  // inviteMember() below requires the invitee to already be a registered customer (looked up by
  // email) and links them immediately, with no separate "pending invite, click to accept" step —
  // same "documented stub, not silently guessed" posture as this codebase's other stubs (e.g.
  // A-004's push-notification TODO). A real invite-by-email-to-a-new-signup flow is a follow-up.
  async resolveEffectiveCustomerId(userId: bigint): Promise<bigint> {
    const membership = await this.prisma.accountMember.findFirst({ where: { memberUserId: userId, revokedAt: null } });
    return membership?.primaryUserId ?? userId;
  }

  async inviteMember(primaryUserId: bigint, email: string): Promise<AccountMemberDto> {
    if (email === (await this.prisma.user.findUniqueOrThrow({ where: { id: primaryUserId } })).email) {
      throw new ApiException('VALIDATION_ERROR', 400, 'Cannot invite your own account');
    }
    const member = await this.prisma.user.findUnique({ where: { email } });
    if (!member || member.role !== 'customer') {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, 'No registered customer account found for that email — they must register first');
    }
    const alreadyPrimaryElsewhere = await this.prisma.accountMember.findFirst({ where: { memberUserId: member.id, revokedAt: null } });
    if (alreadyPrimaryElsewhere) {
      throw new ApiException('CONFLICT', 409, 'That account is already a member of another shared account');
    }

    const row = await this.prisma.accountMember.upsert({
      where: { primaryUserId_memberUserId: { primaryUserId, memberUserId: member.id } },
      create: { primaryUserId, memberUserId: member.id, acceptedAt: new Date() },
      update: { revokedAt: null, acceptedAt: new Date() },
      include: { memberUser: true },
    });
    return toAccountMemberDto(row);
  }

  async listMembers(primaryUserId: bigint): Promise<AccountMemberDto[]> {
    const rows = await this.prisma.accountMember.findMany({ where: { primaryUserId, revokedAt: null }, include: { memberUser: true } });
    return rows.map(toAccountMemberDto);
  }

  async revokeMember(primaryUserId: bigint, memberId: bigint): Promise<void> {
    const row = await this.prisma.accountMember.findFirst({ where: { id: memberId, primaryUserId } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Membership not found');
    await this.prisma.accountMember.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  }
}
