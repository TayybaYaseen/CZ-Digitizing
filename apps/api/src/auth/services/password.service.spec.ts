import { PasswordService } from './password.service';

// bcrypt at the real 12-round cost factor (AC-1) can exceed Jest's default 5000ms on a slower/
// contended CPU — confirmed reproducible even running this file alone, not just under full-suite
// contention. Bumped rather than lowering the cost factor: AC-1 requires 12 rounds in the real
// hash, so the test must actually pay that cost, not fake it.
jest.setTimeout(20000);

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password and verifies the same password against it', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    await expect(service.compare('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a stored hash', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.compare('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a bcrypt hash tagged with the 12-round cost factor (AC-1)', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
