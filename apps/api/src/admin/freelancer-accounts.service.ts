import { Injectable } from '@nestjs/common';
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

    await this.prisma.adminPermission.createMany({
      data: dto.permissions.map((grant) => ({ userId: user.id, module: grant.module, accessLevel: grant.accessLevel })),
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
      changes: { role: dto.role, permissions: dto.permissions },
    });

    return toUserProfileDto(user);
  }

  async list(): Promise<FreelancerAccountDto[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: ['freelancer', 'moderator'] } },
      include: { adminPermissions: { where: { revokedAt: null } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => ({
      ...toUserProfileDto(user),
      permissions: user.adminPermissions.map((grant) => ({ module: grant.module, accessLevel: grant.accessLevel })),
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
