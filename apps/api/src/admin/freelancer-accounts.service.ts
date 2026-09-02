import { Injectable } from '@nestjs/common';
import type { AdminAccessLevel, AdminModule, AdminPermission, User } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import { toUserProfileDto, type UserProfileDto } from '../auth/dto/user-profile.dto';
import { SessionService } from '../auth/services/session.service';
import { VerificationCodeService } from '../auth/services/verification-code.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFreelancerAccountDto } from './dto/create-freelancer-account.dto';

export interface FreelancerAccountDto extends UserProfileDto {
  permissions: { module: string; accessLevel: string }[];
}

// AC-11 — moderator's "approve/reject user-submitted content" baseline, granted automatically so
// it's an inherent property of the role rather than something Admin must remember to configure
// per account, the way a freelancer's fully custom scope is. Limited to modules that actually
// exist today (AdminModule enum) — AC-11 also names "handle support tickets" and "view basic
// analytics", which have no corresponding module/table anywhere in the schema yet (no
// support-ticket aspect exists in SPEC_INDEX.md; analytics belongs to A-005d Admin Dashboard,
// still `Not Started`) and so cannot be granted here without inventing a module the architecture
// never defined — tracked as an open risk in docs/specs/2026-08-28-01-auth-account-security.md §8
// rather than faked with a fabricated enum value.
const DEFAULT_MODERATOR_PERMISSIONS: { module: AdminModule; accessLevel: AdminAccessLevel }[] = [
  { module: 'testimonials', accessLevel: 'crud' },
  { module: 'blog', accessLevel: 'crud' },
  { module: 'portfolio', accessLevel: 'crud' },
  { module: 'faqs', accessLevel: 'crud' },
];

// AC-8 — freelancer/limited-admin account management: scoped creation, listing, and immediate
// revocation (permissions + all active sessions).
@Injectable()
export class FreelancerAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: VerificationCodeService,
    private readonly email: EmailService,
    private readonly sessions: SessionService,
    private readonly audit: AuditLogService,
  ) {}

  async create(dto: CreateFreelancerAccountDto, admin: AccessTokenPayload): Promise<UserProfileDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ApiException('EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        role: dto.role,
        gmailVerified: true, // Admin-vouched "saved Gmail/email" per AC-8, not self-registered
      },
    });

    const permissions = this.resolvePermissions(dto.role, dto.permissions);
    await this.prisma.adminPermission.createMany({
      data: permissions.map((grant) => ({ userId: user.id, module: grant.module, accessLevel: grant.accessLevel })),
    });

    const code = await this.codes.issueResetCode(user.id);
    await this.email.send({
      to: user.email,
      subject: 'Your CZ Digitizing account',
      text: `An admin created a ${dto.role} account for you. Set your password using code ${code} at the reset-password page (valid 10 minutes).`,
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'FREELANCER_ACCOUNT_CREATED',
      resourceType: 'user',
      resourceId: user.id.toString(),
      changes: { role: dto.role, permissions },
    });

    return toUserProfileDto(user);
  }

  // Union, not override — an explicit grant Admin already chose for a moderator-baseline module
  // wins (e.g. a different access level), but the baseline itself is never something Admin has to
  // remember to add. Freelancer accounts are untouched: fully Admin-configured, per AC-8.
  private resolvePermissions(
    role: 'freelancer' | 'moderator',
    explicit: { module: AdminModule; accessLevel: AdminAccessLevel }[],
  ): { module: AdminModule; accessLevel: AdminAccessLevel }[] {
    if (role !== 'moderator') return explicit;

    const explicitModules = new Set(explicit.map((g) => g.module));
    const defaults = DEFAULT_MODERATOR_PERMISSIONS.filter((g) => !explicitModules.has(g.module));
    return [...explicit, ...defaults];
  }

  async list(): Promise<FreelancerAccountDto[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: ['freelancer', 'moderator'] } },
      include: { adminPermissions: { where: { revokedAt: null } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user: User & { adminPermissions: AdminPermission[] }) => ({
      ...toUserProfileDto(user),
      permissions: user.adminPermissions.map((grant: AdminPermission) => ({ module: grant.module, accessLevel: grant.accessLevel })),
    }));
  }

  async revoke(id: string, admin: AccessTokenPayload): Promise<void> {
    const userId = BigInt(id);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'freelancer' && user.role !== 'moderator')) {
      throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Freelancer/limited-admin account not found');
    }

    await this.prisma.adminPermission.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.sessions.revokeAllForUser(userId); // AC-8 — "immediately invalidating its active sessions"

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'FREELANCER_ACCOUNT_REVOKED',
      resourceType: 'user',
      resourceId: id,
    });
  }
}
