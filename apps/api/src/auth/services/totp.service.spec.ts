import { authenticator } from 'otplib';
import type { ConfigService } from '@nestjs/config';
import { TotpService } from './totp.service';
import type { Env } from '../../config/env.validation';

function buildConfig(): ConfigService<Env, true> {
  const key = Buffer.alloc(32, 7).toString('base64');
  return { get: () => key } as unknown as ConfigService<Env, true>;
}

describe('TotpService (AC-5)', () => {
  const service = new TotpService(buildConfig());

  it('generates an enrollment whose secret is not stored in plaintext', () => {
    const enrollment = service.generateEnrollment('admin@example.com');
    expect(enrollment.encryptedSecret).not.toBe(enrollment.secret);
    expect(enrollment.otpauthUrl).toContain('admin%40example.com');
  });

  it('verifies a code generated from the enrolled secret', () => {
    const enrollment = service.generateEnrollment('admin@example.com');
    const code = authenticator.generate(enrollment.secret);
    expect(() => service.verify(code, enrollment.encryptedSecret)).not.toThrow();
  });

  it('rejects an incorrect code', () => {
    const enrollment = service.generateEnrollment('admin@example.com');
    expect(() => service.verify('000000', enrollment.encryptedSecret)).toThrow();
  });
});
