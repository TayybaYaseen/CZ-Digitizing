// Jest integration-test shim for the real `ioredis` package (see jest-integration.json's
// moduleNameMapper). `ioredis-mock` only exposes a default export, but `redis.service.ts` uses
// `import { Redis } from 'ioredis'` against the real package's named export — this re-exports the
// mock under that same name so no application code needs to know it's running against a mock.
import RedisMock from 'ioredis-mock';

export { RedisMock as Redis };
export default RedisMock;
