import { StorageService } from './storage.service';

function createFakeConfig(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as never;
}

function createFakeRedis() {
  const store = new Map<string, string>();
  return {
    client: {
      set: jest.fn(async (key: string, value: string, ..._rest: unknown[]) => {
        if (store.has(key)) return null; // NX semantics: fails if key already exists
        store.set(key, value);
        return 'OK';
      }),
    },
    _store: store,
  };
}

describe('StorageService signed download tokens (AC-4)', () => {
  it('generates a token that verifies successfully before expiry', () => {
    const service = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'a-test-secret-key' }), createFakeRedis() as never);
    const { token } = service.generateSignedToken('42', 600);

    const verified = service.verifyTokenSignature(token);
    expect(verified).not.toBeNull();
    expect(verified?.fileId).toBe('42');
  });

  it('rejects a token whose signature was tampered with', () => {
    const service = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'a-test-secret-key' }), createFakeRedis() as never);
    const { token } = service.generateSignedToken('42', 600);
    const tampered = token.slice(0, -2) + 'zz';

    expect(service.verifyTokenSignature(tampered)).toBeNull();
  });

  it('rejects an expired token even with a valid signature', () => {
    const service = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'a-test-secret-key' }), createFakeRedis() as never);
    const { token } = service.generateSignedToken('42', -1); // already expired

    expect(service.verifyTokenSignature(token)).toBeNull();
  });

  it('a token signed with a different secret does not verify (cross-instance forgery)', () => {
    const a = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'secret-one' }), createFakeRedis() as never);
    const b = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'secret-two' }), createFakeRedis() as never);
    const { token } = a.generateSignedToken('42', 600);

    expect(b.verifyTokenSignature(token)).toBeNull();
  });

  it('claimSingleUse succeeds once and fails on a second attempt for the same jti (replay protection)', async () => {
    const redis = createFakeRedis();
    const service = new StorageService(createFakeConfig({ STORAGE_PRIVATE_ROOT: '/tmp/x', APP_ENCRYPTION_KEY: 'a-test-secret-key' }), redis as never);

    const first = await service.claimSingleUse('jti-1', 600);
    const second = await service.claimSingleUse('jti-1', 600);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
