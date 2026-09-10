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

  // A code from the immediately-preceding 30s step must still verify — otherwise the ordinary
  // read-code-off-phone-then-type-it latency intermittently rejects a genuinely correct code.
  it('accepts a code from the previous 30-second step (submission latency tolerance)', () => {
    const enrollment = service.generateEnrollment('admin@example.com');
    const realNow = Date.now;
    Date.now = () => realNow() - 30000;
    const previousStepCode = authenticator.generate(enrollment.secret);
    Date.now = realNow;

    expect(() => service.verify(previousStepCode, enrollment.encryptedSecret)).not.toThrow();
  });
});
