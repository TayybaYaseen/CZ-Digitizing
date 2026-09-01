import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MagicLinkService } from './services/magic-link.service';
import { OAuthService } from './services/oauth.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { TotpService } from './services/totp.service';
import { VerificationCodeService } from './services/verification-code.service';

// @Global so TokenService/SessionService are injectable by guards (common/guards/*) and other
// feature modules (e.g. AdminModule) without each importing AuthModule explicitly — same pattern
// PrismaModule already uses.
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    VerificationCodeService,
    TotpService,
    OAuthService,
    MagicLinkService,
  ],
  exports: [TokenService, SessionService, PasswordService, VerificationCodeService],
})
export class AuthModule {}
