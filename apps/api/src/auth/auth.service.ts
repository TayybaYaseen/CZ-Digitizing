import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminPermission, User } from '../generated/prisma';
import { ApiException } from '../common/exceptions/api-exception';
import type { Env } from '../config/env.validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthTokensDto, PendingTwoFactorDto, TwoFactorSetupDto } from './dto/auth-tokens.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { toUserProfileDto, type UserProfileDto } from './dto/user-profile.dto';
import type { VerifyNewDeviceDto } from './dto/verify-new-device.dto';
import { MagicLinkService } from './services/magic-link.service';
import { type OAuthProvider, OAuthService } from './services/oauth.service';
import { PasswordService } from './services/password.service';
import { type DeviceContext, SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { TotpService } from './services/totp.service';
import { VerificationCodeService } from './services/verification-code.service';
import type { AccessTokenPayload, PartialSessionTokenPayload } from './token.types';

function isPendingTwoFactor(result: AuthTokensDto | PendingTwoFactorDto): result is PendingTwoFactorDto {
  return 'pendingTwoFactorToken' in result;
}

@Injectable()
export class AuthService {
  private readonly webBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly codes: VerificationCodeService,
    private readonly totp: TotpService,
    private readonly oauth: OAuthService,
    private readonly magicLink: MagicLinkService,
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
  }

  // --- Registration (AC-1) ---

  async register(dto: RegisterDto): Promise<UserProfileDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ApiException('EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, displayName: dto.displayName, role: 'customer' },
    });

    const token = this.tokens.signEmailVerificationToken(user.id);
    await this.email.send({
      to: user.email,
      subject: 'Verify your CZ Digitizing account',
      text: `Verify your email: ${this.webBaseUrl}/verify-email?token=${encodeURIComponent(token)}`,
    });

    return toUserProfileDto(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = this.tokens.verifyEmailVerificationToken(token);
    await this.prisma.user.update({ where: { id: BigInt(payload.sub) }, data: { gmailVerified: true } });
  }

  // --- Login (AC-2/AC-3/AC-5/AC-11) ---

  async login(dto: LoginDto, device: DeviceContext): Promise<AuthTokensDto | PendingTwoFactorDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await this.passwords.compare(dto.password, user.passwordHash))) {
      throw new ApiException('UNAUTHENTICATED', 401, 'Invalid email or password');
    }
    return this.completeCredentialCheck(user, device);
  }

  // AC-5 — "regardless of device trust": for role=admin, TOTP replaces the customer new-device
  // email-code gate entirely rather than stacking on top of it; every other role uses the normal
  // device-trust branching (AC-2/AC-3), which also covers moderator (AC-11) with no special-casing.
  private async completeCredentialCheck(user: User, device: DeviceContext): Promise<AuthTokensDto | PendingTwoFactorDto> {
    if (user.role === 'admin') {
      const pendingTwoFactorToken = this.tokens.signPendingTwoFactorToken({ userId: user.id, deviceId: device.deviceId });
      return { pendingTwoFactorToken, setupRequired: !user.twoFactorEnabled };
    }
    return this.completeDeviceTrustLogin(user, device);
  }

  private async completeDeviceTrustLogin(user: User, device: DeviceContext): Promise<AuthTokensDto> {
    const trusted = await this.sessions.findTrustedSession(user.id, device.deviceId);
    if (trusted) {
      await this.sessions.touch(trusted.id);
      return this.issueTokens(user, trusted.id, device.deviceId);
    }

    const pending = await this.sessions.createUnverifiedSession(user.id, device);
    const code = await this.codes.issueDeviceCode(pending.id);
    await this.email.send({
      to: user.email,
      subject: 'Verify this new device',
      text: `Your verification code is ${code}. It expires in 15 minutes.`,
    });

    const others = await this.sessions.listOtherTrustedSessions(user.id, device.deviceId);
    if (others.length > 0) {
      await this.email.send({
        to: user.email,
        subject: 'New login attempt on your account',
        text: 'A login was just attempted from a device we don’t recognize. If this wasn’t you, reset your password.',
      });
    }

    throw new ApiException('NEW_DEVICE_VERIFICATION_REQUIRED', 401, 'Verification code sent to your email');
  }

  async verifyNewDevice(dto: VerifyNewDeviceDto, device: DeviceContext): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    const pending = await this.prisma.session.findFirst({
      where: { userId: user.id, deviceId: device.deviceId, isVerified: false, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    await this.codes.verifyDeviceCode(pending.id, dto.code); // AC-4
    const verified = await this.sessions.markVerifiedAndExtend(pending.id);
    return this.issueTokens(user, verified.id, device.deviceId);
  }

  // --- Admin 2FA (AC-5) ---

  async setupTwoFactor(pending: PartialSessionTokenPayload): Promise<TwoFactorSetupDto> {
    const user = await this.getUserOrThrow(BigInt(pending.sub));

    // Idempotent while setup is still in progress (twoFactorEnabled still false) — a page
    // refresh, React StrictMode's double-effect in dev (exactly what triggers this on
    // /login/2fa's mount), or a retried request must never silently invalidate a secret the user
    // already scanned into their authenticator app. Only mint a new one when there truly isn't
    // one yet, or when 2FA was previously enabled and this is a deliberate re-setup.
    if (user.twoFactorSecret && !user.twoFactorEnabled) {
      const secret = this.totp.decryptSecret(user.twoFactorSecret);
      return { otpauthUrl: this.totp.otpauthUrl(user.email, secret), secret };
    }

    const enrollment = this.totp.generateEnrollment(user.email);
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: enrollment.encryptedSecret } });
    return { otpauthUrl: enrollment.otpauthUrl, secret: enrollment.secret };
  }

  async confirmTwoFactorSetup(pending: PartialSessionTokenPayload, code: string): Promise<AuthTokensDto> {
    const user = await this.getUserOrThrow(BigInt(pending.sub));
    if (!user.twoFactorSecret) throw new ApiException('VALIDATION_ERROR', 400, 'Call /api/auth/2fa/setup first');

    this.totp.verify(code, user.twoFactorSecret);
    const confirmed = await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    return this.completeAdminSession(confirmed, pending.device_id);
  }

  async verifyTwoFactor(pending: PartialSessionTokenPayload, code: string): Promise<AuthTokensDto> {
    const user = await this.getUserOrThrow(BigInt(pending.sub));
    if (!user.twoFactorSecret) throw new ApiException('VALIDATION_ERROR', 400, 'Complete 2FA setup first');

    this.totp.verify(code, user.twoFactorSecret);
    return this.completeAdminSession(user, pending.device_id);
  }

  private async completeAdminSession(user: User, deviceId: string): Promise<AuthTokensDto> {
    const existing = await this.sessions.findTrustedSession(user.id, deviceId);
    const session = existing
      ? await this.sessions.touch(existing.id)
      : await this.sessions.markVerifiedAndExtend((await this.sessions.createUnverifiedSession(user.id, { deviceId })).id);
    return this.issueTokens(user, session.id, deviceId);
  }

  // --- Forgot / reset password (AC-6) ---

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return; // never reveal whether the email exists

    const code = await this.codes.issueResetCode(user.id);
    await this.email.send({
      to: user.email,
      subject: 'Reset your CZ Digitizing password',
      text: `Your password reset code is ${code}. It expires in 10 minutes.`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    await this.codes.verifyResetCode(user.id, dto.code);
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.codes.consumeResetCode(user.id);
    await this.sessions.revokeAllForUser(user.id); // AC-6 — every existing session revoked
  }

  // --- Token lifecycle ---

  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string }> {
    const payload = this.tokens.verifyRefreshToken(dto.refreshToken);
    const session = await this.sessions.getActiveSessionOrThrow(payload.session_id); // AC-7
    const user = await this.getUserOrThrow(BigInt(payload.sub));
    await this.sessions.touch(session.id);

    const permissions = await this.computePermissions(user);
    const accessToken = this.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      deviceId: session.deviceId,
      permissions,
    });
    return { accessToken };
  }

  async logout(caller: AccessTokenPayload): Promise<void> {
    const session = await this.sessions.findTrustedSession(BigInt(caller.sub), caller.device_id);
    if (session) await this.sessions.revoke(session.id);
  }

  async verifySession(caller: AccessTokenPayload): Promise<UserProfileDto> {
    const session = await this.sessions.findTrustedSession(BigInt(caller.sub), caller.device_id);
    if (!session) throw new ApiException('UNAUTHENTICATED', 401, 'Session expired or revoked'); // AC-7
    await this.sessions.touch(session.id);
    return toUserProfileDto(await this.getUserOrThrow(BigInt(caller.sub)));
  }

  // --- OAuth (AC-10) ---

  buildOAuthUrl(provider: OAuthProvider, state: string): string {
    return this.oauth.buildAuthorizationUrl(provider, state);
  }

  async completeOAuthLogin(provider: OAuthProvider, code: string, device: DeviceContext): Promise<AuthTokensDto | PendingTwoFactorDto> {
    const profile = await this.oauth.exchangeCodeForProfile(provider, code);
    if (!profile.emailVerified) throw new ApiException('VALIDATION_ERROR', 401, 'OAuth account email is not verified');

    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    user ??= await this.prisma.user.create({
      data: { email: profile.email, displayName: profile.displayName, role: 'customer', gmailVerified: true },
    });

    return this.completeCredentialCheck(user, device);
  }

  // --- Magic link (AC-12) ---

  async requestMagicLink(dto: MagicLinkRequestDto, device: DeviceContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user) await this.magicLink.sendLoginLink({ userId: user.id, email: user.email, deviceId: device.deviceId });
  }

  async verifyMagicLink(token: string, device: DeviceContext): Promise<AuthTokensDto | PendingTwoFactorDto> {
    const payload = this.tokens.verifyMagicLinkToken(token);
    if (payload.device_id !== device.deviceId) {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired magic link');
    }
    // AC-12 — a signature-valid, unexpired JWT is otherwise replayable indefinitely within its
    // 15-minute window; a link sent over email must be single-use, not just time-bounded.
    if (!(await this.magicLink.claimSingleUse(payload.jti))) {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'This login link has already been used');
    }
    const user = await this.getUserOrThrow(BigInt(payload.sub));
    return this.completeCredentialCheck(user, device);
  }

  // --- Shared helpers ---

  private async issueTokens(user: User, sessionId: string, deviceId: string): Promise<AuthTokensDto> {
    const permissions = await this.computePermissions(user);
    const accessToken = this.tokens.signAccessToken({ userId: user.id, email: user.email, role: user.role, deviceId, permissions });
    const refreshToken = this.tokens.signRefreshToken({ userId: user.id, sessionId });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken, refreshToken, user: toUserProfileDto(user) };
  }

  // AC-8/AC-21 — freelancer/moderator get the granular AdminPermission set; customer/admin don't
  // use this claim (admin's full access comes from role alone, per RolesGuard).
  private async computePermissions(user: User): Promise<string[]> {
    if (user.role !== 'freelancer' && user.role !== 'moderator') return [];
    const grants = await this.prisma.adminPermission.findMany({ where: { userId: user.id, revokedAt: null } });
    return grants.map((grant: AdminPermission) => `${grant.module}:${grant.accessLevel}`);
  }

  private async getUserOrThrow(id: bigint): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiException('UNAUTHENTICATED', 401, 'User not found');
    return user;
  }
}

export { isPendingTwoFactor };
