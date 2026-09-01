import { PasswordService } from './password.service';

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
