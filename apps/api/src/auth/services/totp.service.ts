import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { ApiException } from '../../common/exceptions/api-exception';
import { SecretCipher } from '../../common/crypto/secret-cipher';
import type { Env } from '../../config/env.validation';

// Admin 2FA (AC-5). Secret is generated here, returned once as an otpauth:// URI for the caller
// to render as a QR code, and only the AES-256-GCM-encrypted form is ever persisted
// (users.two_factor_secret) — apps/api/src/common/crypto/secret-cipher.ts.
@Injectable()
export class TotpService {
  private readonly cipher: SecretCipher;

  constructor(config: ConfigService<Env, true>) {
    this.cipher = SecretCipher.fromBase64Key(config.get('APP_ENCRYPTION_KEY', { infer: true }));
  }

  generateEnrollment(email: string): { secret: string; encryptedSecret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    return {
      secret,
      encryptedSecret: this.cipher.encrypt(secret),
      otpauthUrl: this.otpauthUrl(email, secret),
    };
  }

  otpauthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, 'CZ Digitizing', secret);
  }

  decryptSecret(encryptedSecret: string): string {
    return this.cipher.decrypt(encryptedSecret);
  }

  verify(code: string, encryptedSecret: string): void {
    const secret = this.cipher.decrypt(encryptedSecret);
    if (!authenticator.check(code, secret)) {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid authenticator code');
    }
  }
}
