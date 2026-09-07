import { FreelancerAccountsService } from './freelancer-accounts.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1n,
    email: 'staff@example.com',
    displayName: 'Staff',
    role: 'freelancer',
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeGrant(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 1n, userId: 1n, module: 'designs', accessLevel: 'read_only', revokedAt: null as Date | null, ...overrides };
}

function createHarness(users: ReturnType<typeof makeUser>[], grants: ReturnType<typeof makeGrant>[] = []) {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id?: bigint; email?: string } }) =>
        users.find((u) => (where.id !== undefined ? u.id === where.id : u.email === where.email)) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { role: { in: string[] } } }) =>
        users
          .filter((u) => where.role.in.includes(u.role as string))
          .map((u) => ({ ...u, adminPermissions: grants.filter((g) => g.userId === u.id && g.revokedAt === null) })),
      ),
      create: jest.fn(),
    },
    adminPermission: {
      createMany: jest.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        grants.push(...data.map((d, i) => makeGrant({ ...d, id: BigInt(grants.length + i + 1) })));
      }),
      updateMany: jest.fn(async ({ where }: { where: { userId: bigint; revokedAt: null } }) => {
        for (const g of grants) if (g.userId === where.userId && g.revokedAt === null) g.revokedAt = new Date();
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: bigint; revokedAt: null } }) =>
        grants.filter((g) => g.userId === where.userId && g.revokedAt === null),
      ),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const codes = { issueResetCode: jest.fn(async () => '1234') };
  const email = { send: jest.fn(async () => undefined) };
  const sessions = {
    revokeAllForUser: jest.fn(async () => undefined),
    listActiveForUser: jest.fn(async () => [{ id: 's1', deviceId: 'd1' }]),
    revokeForUser: jest.fn(async () => undefined),
  };
  const audit = { record: jest.fn(async () => undefined) };

  const service = new FreelancerAccountsService(prisma as never, codes as never, email as never, sessions as never, audit as never);
  return { service, prisma, sessions, audit, grants };
}

const admin = { sub: '99', email: 'admin@example.com', role: 'admin' as const, device_id: 'd', permissions: [], iat: 0, exp: 0 };

describe('FreelancerAccountsService (A-005f: Admin Users/Roles & Active Sessions)', () => {
  it('list() includes admin-role accounts alongside freelancer/moderator (read-only visibility)', async () => {
    const { service } = createHarness([
      makeUser({ id: 1n, role: 'admin' }),
      makeUser({ id: 2n, role: 'freelancer' }),
      makeUser({ id: 3n, role: 'customer' }),
    ]);
    const list = await service.list();
    expect(list.map((u) => u.role).sort()).toEqual(['admin', 'freelancer']);
  });

  it('updatePermissions() replaces a freelancer account\'s grants', async () => {
    const { service, grants } = createHarness(
      [makeUser({ id: 2n, role: 'freelancer' })],
      [makeGrant({ userId: 2n, module: 'designs', accessLevel: 'read_only' })],
    );
    const result = await service.updatePermissions('2', { permissions: [{ module: 'orders' as never, accessLevel: 'crud' as never }] }, admin);
    expect(result.permissions).toEqual([{ module: 'orders', accessLevel: 'crud' }]);
    expect(grants.find((g) => g.module === 'designs')!.revokedAt).not.toBeNull();
  });

  it('updatePermissions() re-applies the moderator baseline when omitted, same as create', async () => {
    const { service } = createHarness([makeUser({ id: 4n, role: 'moderator' })]);
    const result = await service.updatePermissions('4', { permissions: [{ module: 'orders' as never, accessLevel: 'crud' as never }] }, admin);
    const modules = result.permissions.map((p) => p.module);
    expect(modules).toEqual(expect.arrayContaining(['orders', 'testimonials', 'blog', 'portfolio', 'faqs']));
  });

  it('updatePermissions() refuses to edit an admin-role account\'s scope', async () => {
    const { service } = createHarness([makeUser({ id: 1n, role: 'admin' })]);
    await expect(service.updatePermissions('1', { permissions: [{ module: 'orders' as never, accessLevel: 'crud' as never }] }, admin)).rejects.toThrow();
  });

  it('listSessions() works for any staff role, including admin', async () => {
    const { service, sessions } = createHarness([makeUser({ id: 1n, role: 'admin' })]);
    const result = await service.listSessions('1');
    expect(sessions.listActiveForUser).toHaveBeenCalledWith(1n);
    expect(result).toEqual([{ id: 's1', deviceId: 'd1' }]);
  });

  it('listSessions() throws for a non-staff (customer) account', async () => {
    const { service } = createHarness([makeUser({ id: 5n, role: 'customer' })]);
    await expect(service.listSessions('5')).rejects.toThrow();
  });

  it('revokeSession() delegates to SessionService and writes an audit entry', async () => {
    const { service, sessions, audit } = createHarness([makeUser({ id: 2n, role: 'freelancer' })]);
    await service.revokeSession('2', 's1', admin);
    expect(sessions.revokeForUser).toHaveBeenCalledWith('s1', 2n);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'ADMIN_SESSION_REVOKED', resourceId: 's1' }));
  });

  it('revoke() still refuses to touch an admin-role account (existing AC-8 invariant)', async () => {
    const { service } = createHarness([makeUser({ id: 1n, role: 'admin' })]);
    await expect(service.revoke('1', admin)).rejects.toThrow();
  });
});
