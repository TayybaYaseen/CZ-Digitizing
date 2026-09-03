import type { AuditLogEntry } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { PlatformSettingsService } from './platform-settings.service';

const ADMIN: AccessTokenPayload = { sub: '1', email: 'admin@czd.com', role: 'admin', device_id: 'd', permissions: [], iat: 0, exp: 0 };

function createFakePrisma(initial: Record<string, unknown>) {
  const row: Record<string, unknown> = { ...initial };
  return {
    platformSettings: {
      findUniqueOrThrow: jest.fn(async () => ({ ...row })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(row, data);
        return { ...row };
      }),
    },
    paymentMethodSetting: {
      findMany: jest.fn(async () => []),
    },
  };
}

function createFakeAudit() {
  return { record: jest.fn(async (_entry: AuditLogEntry) => undefined) };
}

describe('PlatformSettingsService (AC-1, AC-6)', () => {
  it('updates the contact fields and writes an audit_logs diff of only the changed fields', async () => {
    const prisma = createFakePrisma({ whatsappNumber: '+92 000', contactEmail: 'old@czd.com', experienceStartYear: 2016 });
    const audit = createFakeAudit();
    const service = new PlatformSettingsService(prisma as never, audit as never);

    const result = await service.updateContact({ whatsappNumber: '+92 317 4604508', contactEmail: 'new@czd.com' }, ADMIN);

    expect(result.whatsappNumber).toBe('+92 317 4604508');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'SETTINGS_UPDATED',
        resourceType: 'platform_settings',
        changes: {
          whatsappNumber: { before: '+92 000', after: '+92 317 4604508' },
          contactEmail: { before: 'old@czd.com', after: 'new@czd.com' },
        },
      }),
    );
  });

  it('does not log a diff entry for a field that did not change', async () => {
    const prisma = createFakePrisma({ whatsappNumber: '+92 317 4604508', contactEmail: 'same@czd.com', experienceStartYear: 2016 });
    const audit = createFakeAudit();
    const service = new PlatformSettingsService(prisma as never, audit as never);

    await service.updateContact({ whatsappNumber: '+92 317 4604508', contactEmail: 'new@czd.com' }, ADMIN);

    const changes = audit.record.mock.calls[0]?.[0]?.changes;
    expect(changes).not.toHaveProperty('whatsappNumber');
    expect(changes).toHaveProperty('contactEmail');
  });
});
