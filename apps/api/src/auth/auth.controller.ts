import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { ApiException } from '../common/exceptions/api-exception';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PendingTwoFactorGuard, type PendingTwoFactorRequest } from '../common/guards/pending-two-factor.guard';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { AuthService } from './auth.service';
import {
  DEVICE_CODE_MAX_ATTEMPTS,
  DEVICE_ID_COOKIE,
  DEVICE_ID_COOKIE_MAX_AGE_MS,
  RESET_CODE_MAX_ATTEMPTS,
} from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { VerifyNewDeviceDto } from './dto/verify-new-device.dto';
import type { DeviceContext } from './services/session.service';
import type { OAuthProvider } from './services/oauth.service';
import type { AccessTokenPayload } from './token.types';

const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'facebook'];

function assertProvider(provider: string): OAuthProvider {
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    throw new ApiException('VALIDATION_ERROR', 400, `Unknown OAuth provider "${provider}"`);
  }
  return provider as OAuthProvider;
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Resolves the device-trust cookie chosen for AC-2/AC-3 (spec §8 risk #2), minting one on
  // first contact so even an unauthenticated register/login call gets a stable device id.
  private resolveDevice(req: Request, res: Response): DeviceContext {
    const deviceId = req.cookies?.[DEVICE_ID_COOKIE] ?? randomUUID();
    res.cookie(DEVICE_ID_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEVICE_ID_COOKIE_MAX_AGE_MS,
    });
    return { deviceId, ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @RateLimit(10, 60) // AC-1 — "rate-limited per IP"
  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.auth.verifyEmail(token);
    return { verified: true };
  }

  @Public()
  @RateLimit(20, 60) // spec §9 rollout — "alert on abnormal login-failure rate per IP"
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, this.resolveDevice(req, res));
  }

  @Public()
  @RateLimit(DEVICE_CODE_MAX_ATTEMPTS, 15 * 60) // AC-4
  @Post('verify-new-device')
  @HttpCode(200)
  verifyNewDevice(@Body() dto: VerifyNewDeviceDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyNewDevice(dto, this.resolveDevice(req, res));
  }

  // @Public() skips the global JwtAuthGuard's full-access-token requirement — these routes are
  // authorized by PendingTwoFactorGuard instead (the "partial session" from spec §3's auth policy).
  @Public()
  @UseGuards(PendingTwoFactorGuard)
  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@Req() req: PendingTwoFactorRequest) {
    return this.auth.setupTwoFactor(req.pendingTwoFactor);
  }

  @Public()
  @UseGuards(PendingTwoFactorGuard)
  @Post('2fa/confirm')
  @HttpCode(200)
  confirmTwoFactorSetup(@Req() req: PendingTwoFactorRequest, @Body() dto: Verify2faDto) {
    return this.auth.confirmTwoFactorSetup(req.pendingTwoFactor, dto.code);
  }

  @Public()
  @UseGuards(PendingTwoFactorGuard)
  @Post('verify-2fa')
  @HttpCode(200)
  verifyTwoFactor(@Req() req: PendingTwoFactorRequest, @Body() dto: Verify2faDto) {
    return this.auth.verifyTwoFactor(req.pendingTwoFactor, dto.code);
  }

  @Public()
  @RateLimit(RESET_CODE_MAX_ATTEMPTS, 15 * 60) // AC-6 — "password-reset spam"
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto);
    return { requested: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
    return { reset: true };
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(200)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AccessTokenPayload) {
    await this.auth.logout(user);
  }

  @Get('verify-session')
  @HttpCode(200)
  verifySession(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.verifySession(user);
  }

  @Public()
  @Get('oauth/:provider')
  oauthRedirect(@Param('provider') provider: string, @Res() res: Response) {
    const url = this.auth.buildOAuthUrl(assertProvider(provider), randomUUID());
    res.redirect(url);
  }

  @Public()
  @Get('oauth/:provider/callback')
  oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.completeOAuthLogin(assertProvider(provider), code, this.resolveDevice(req, res));
  }

  @Public()
  @Post('magic-link/request')
  @HttpCode(200)
  async requestMagicLink(@Body() dto: MagicLinkRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.requestMagicLink(dto, this.resolveDevice(req, res));
    return { requested: true };
  }

  @Public()
  @Get('magic-link/verify')
  verifyMagicLink(@Query('token') token: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyMagicLink(token, this.resolveDevice(req, res));
  }
}
