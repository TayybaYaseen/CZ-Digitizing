import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminPermission, User } from '../generated/prisma';
import { ApiException } from '../common/exceptions/api-exception';
import type { Env } from '../config/env.validation';
import { EmailService } from '../email/email.service';
import { DEFAULT_CHANNELS } from '../notifications/notifications.constants';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEVICE_CODE_TTL_MS, RESET_CODE_TTL_MS } from './auth.constants';
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
import {
  renderPasswordResetEmail,
  renderVerificationCodeEmail,
  renderWelcomeEmail,
  type VerificationEmailContact,
} from './templates/verification-code-email.template';
import type { AccessTokenPayload, PartialSessionTokenPayload } from './token.types';

function isPendingTwoFactor(result: AuthTokensDto | PendingTwoFactorDto): result is PendingTwoFactorDto {
  return 'pendingTwoFactorToken' in result;
}

function pendingToDevice(pending: PartialSessionTokenPayload): DeviceContext {
  return { deviceId: pending.device_id, ipAddress: pending.ip_address, userAgent: pending.user_agent };
}

@Injectable()
export class AuthService {
  private readonly webBaseUrl: string;
  private readonly registrationBatchEnabled: boolean;

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
    private readonly notifications: NotificationService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
    this.registrationBatchEnabled = config.get('NOTIFY_REGISTRATION_BATCH_ENABLED', { infer: true });
  }

  // --- Registration (AC-1) ---

  async register(dto: RegisterDto): Promise<UserProfileDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ApiException('EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, displayName: dto.displayName, role: 'customer' },
    });

    // A welcome email only — registration no longer issues an email-verification code or link.
    // The verify-email / verify-email-code endpoints stay, so links and codes already sent (and
    // older app builds) keep working. Ownership of the address is still proven on first sign-in:
    // every new device must enter the code emailed by the new-device check.
    await this.email.send({
      to: user.email,
      ...renderWelcomeEmail({
        name: user.displayName,
        webBaseUrl: this.webBaseUrl,
        contact: await this.loadEmailContact(),
      }),
    });

    // AC-8 (Customer Account & Purchase History, aspect A-019) — retroactively link any guest
    // quote submitted with this same email before this account existed. Done directly against
    // Prisma rather than via AccountService: CustomRequestsModule (imported by AccountModule)
    // already imports AuthModule, so AuthModule depending on AccountModule back would be a cycle —
    // this one-line update doesn't need a shared service to justify introducing it.
    await this.prisma.quote.updateMany({ where: { customerId: null, email: user.email }, data: { customerId: user.id } });

    await this.notifyAdminsOfNewRegistration(user);
    return toUserProfileDto(user);
  }

  // docs/specs/2026-08-28-02-notifications-system.md AC-1/AC-2 — real-time per-registration Admin
  // notification (a Notification row + email/in-app dispatch), called from every path that actually
  // creates a new customer account (register() above, and completeOAuthLogin() below only when that
  // OAuth sign-in just created the account rather than logging an existing one in — so those two
  // paths can never double-fire for the same registration event).
  //
  // Gated on !registrationBatchEnabled — CZ_DIGITIZING_ARCHITECTURE.md's own trigger table
  // describes this exact trigger as "Delay: Hourly batch (if enabled)", i.e. the hourly digest
  // (NotificationBatchingService.sendRegistrationDigest(), same NOTIFY_REGISTRATION_BATCH_ENABLED
  // flag) is the alternative delivery mode for this trigger, not an addition on top of it. Without
  // this gate, an operator turning the batch flag on would get both this real-time entry per signup
  // AND the hourly summary re-listing the same registrations — a genuine duplicate. When the flag
  // is on, this method is a no-op and the digest is the sole Admin-facing signal, matching the
  // architecture text; when it's off (default), this is the only signal, satisfying this spec's own
  // AC-2 (registration in the Admin dashboard's chronological list) which the digest alone can never
  // satisfy (it sends a raw summary email, no Notification row).
  private async notifyAdminsOfNewRegistration(user: User): Promise<void> {
    if (this.registrationBatchEnabled) return;
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'new_registration',
        title: 'New customer registration',
        message: `${user.displayName ?? user.email} (${user.email}) just created an account.`,
        channels: DEFAULT_CHANNELS.new_registration,
      });
    }
  }

  // Footer contact/social details for the auth emails — the same platform_settings values
  // (Admin → Settings → Contact / Social) the public site footer shows, so nothing is hard-coded.
  private async loadEmailContact(): Promise<VerificationEmailContact> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
      select: {
        contactEmail: true,
        whatsappNumber: true,
        facebookUrl: true,
        instagramUrl: true,
        linkedinUrl: true,
        xTwitterUrl: true,
        youtubeUrl: true,
      },
    });
    return {
      contactEmail: settings?.contactEmail ?? null,
      whatsappNumber: settings?.whatsappNumber ?? null,
      social: [
        { label: 'Facebook', url: settings?.facebookUrl },
        { label: 'Instagram', url: settings?.instagramUrl },
        { label: 'LinkedIn', url: settings?.linkedinUrl },
        { label: 'X', url: settings?.xTwitterUrl },
        { label: 'YouTube', url: settings?.youtubeUrl },
      ].filter((link): link is { label: string; url: string } => !!link.url),
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = this.tokens.verifyEmailVerificationToken(token);
    await this.prisma.user.update({ where: { id: BigInt(payload.sub) }, data: { gmailVerified: true } });
  }

  // Code counterpart to verifyEmail above (aspect A-023) — same effect, different client-provided
  // proof. Looked up by email since the customer has no session yet at this point in the flow,
  // mirroring resetPassword's own email-keyed lookup just below.
  async verifyEmailByCode(email: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    await this.codes.verifyEmailCode(user.id, code);
    await this.prisma.user.update({ where: { id: user.id }, data: { gmailVerified: true } });
    await this.codes.consumeEmailCode(user.id);
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
      const pendingTwoFactorToken = this.tokens.signPendingTwoFactorToken({
        userId: user.id,
        deviceId: device.deviceId,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      });
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
    await this.sendDeviceCode(user, pending.id);

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

  // Issues a fresh code on the pending session (replacing any earlier one, attempts reset, new
  // expiry) and emails it — shared by the login branch above and resendDeviceCode() below.
  private async sendDeviceCode(user: User, sessionId: string): Promise<void> {
    const code = await this.codes.issueDeviceCode(sessionId);
    await this.email.send({
      to: user.email,
      ...renderVerificationCodeEmail({
        code,
        expiresInMinutes: DEVICE_CODE_TTL_MS / 60_000,
        webBaseUrl: this.webBaseUrl,
        contact: await this.loadEmailContact(),
      }),
    });
  }

  // "Resend code" on the verify-device page. Only re-sends for a pending session that already
  // exists for this exact device (same device-id cookie/header), i.e. one created by a login
  // that passed the password check on this device — so it grants nothing a second password login
  // wouldn't. Silent no-op for an unknown email or no pending session, so the response never
  // reveals whether an account exists. Does not repeat the "new login attempt" alert.
  async resendDeviceCode(email: string, device: DeviceContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const pending = await this.prisma.session.findFirst({
      where: { userId: user.id, deviceId: device.deviceId, isVerified: false, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) return;

    await this.sendDeviceCode(user, pending.id);
  }

  async verifyNewDevice(dto: VerifyNewDeviceDto, device: DeviceContext): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    const pending = await this.prisma.session.findFirst({
      where: { userId: user.id, deviceId: device.deviceId, isVerified: false, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    await this.codes.verifyDeviceCode(pending.id, dto.code); // AC-4 — checks the code, doesn't
    // consume it, so two concurrent verify-new-device requests (retry/double-submit) can both pass
    // this check for the same session. The conditional updateMany below is the actual atomic
    // "claim" — only whichever request flips isVerified false->true first gets count > 0, so the
    // new_device_login notification below can only ever fire once per real device-trust event, no
    // matter how many concurrent requests raced on it. markVerifiedAndExtend still runs
    // unconditionally after so every caller (winner or not) gets a valid extended session/tokens —
    // this only gates the notification, not the login itself.
    const { count: wonVerificationRace } = await this.prisma.session.updateMany({
      where: { id: pending.id, isVerified: false },
      data: { isVerified: true },
    });
    const verified = await this.sessions.markVerifiedAndExtend(pending.id);

    // docs/specs/2026-08-28-02-notifications-system.md AC-1 — fired once the device is actually
    // confirmed/trusted (not on the earlier "verification required" branch in
    // completeDeviceTrustLogin(), which is an unverified attempt, not a login yet). Customer-facing,
    // not Admin — the account owner is the one who needs to know a new device just signed in.
    if (wonVerificationRace > 0) {
      await this.notifications.notify({
        recipientUserId: user.id.toString(),
        type: 'new_device_login',
        title: 'New device signed in',
        message: `Your account was just signed in from a new device${device.ipAddress ? ` (IP ${device.ipAddress})` : ''}. If this wasn't you, reset your password immediately.`,
        channels: DEFAULT_CHANNELS.new_device_login,
      });
    }

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
    return this.completeAdminSession(confirmed, pendingToDevice(pending));
  }

  async verifyTwoFactor(pending: PartialSessionTokenPayload, code: string): Promise<AuthTokensDto> {
    const user = await this.getUserOrThrow(BigInt(pending.sub));
    if (!user.twoFactorSecret) throw new ApiException('VALIDATION_ERROR', 400, 'Complete 2FA setup first');

    this.totp.verify(code, user.twoFactorSecret);
    return this.completeAdminSession(user, pendingToDevice(pending));
  }

  private async completeAdminSession(user: User, device: DeviceContext): Promise<AuthTokensDto> {
    const existing = await this.sessions.findTrustedSession(user.id, device.deviceId);
    const session = existing
      ? await this.sessions.touch(existing.id)
      : await this.sessions.markVerifiedAndExtend((await this.sessions.createUnverifiedSession(user.id, device)).id);
    return this.issueTokens(user, session.id, device.deviceId);
  }

  // --- Forgot / reset password (AC-6) ---

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return; // never reveal whether the email exists

    const code = await this.codes.issueResetCode(user.id);
    await this.email.send({
      to: user.email,
      ...renderPasswordResetEmail({
        code,
        expiresInMinutes: RESET_CODE_TTL_MS / 60_000,
        name: user.displayName,
        webBaseUrl: this.webBaseUrl,
        contact: await this.loadEmailContact(),
      }),
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
    const isNewRegistration = !user;
    user ??= await this.prisma.user.create({
      data: { email: profile.email, displayName: profile.displayName, role: 'customer', gmailVerified: true },
    });
    if (isNewRegistration) await this.notifyAdminsOfNewRegistration(user);

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
    return { accessToken, refreshToken, user: toUserProfileDto(user), deviceId };
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
