// e2e/jest.config.js — root-level API test runner for e2e/*.e2e.spec.ts. Mirrors apps/api/test/
// jest-integration.json's shape (rootDir + ts-jest against apps/api's own tsconfig, since these
// specs import apps/api's AppModule/PrismaService directly) but scoped to this repo-root e2e/
// directory instead, per the mobile-app spec's own test-plan table
// (docs/specs/2026-08-29-18-mobile-app-android-ios.md §6:
// "e2e/cross-platform-sync.e2e.spec.ts").
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  // rootDir is the repo root (not e2e/) so node_modules resolution finds ts-jest etc. via
  // apps/api's dependencies (pnpm workspace hoisting) — same reasoning as apps/api/test/
  // jest-integration.json using its own package's node_modules.
  transform: { '^.+\\.ts$': ['<rootDir>/apps/api/node_modules/ts-jest', { tsconfig: '<rootDir>/apps/api/tsconfig.json' }] },
  testRegex: 'e2e[\\\\/].*\\.e2e\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // modulePaths (absolute search paths), not moduleDirectories (which only takes directory
  // *names*) — forces every `require()` this suite triggers (express, path-to-regexp, etc.) to
  // resolve from apps/api's own pinned node_modules first, exactly like apps/api/test/
  // jest-integration.json's own tests do. Without this, Jest's default ancestor-walk from e2e/
  // finds the repo root's node_modules first, which can hold a different (incompatible) hoisted
  // version of a transitive dependency like express/path-to-regexp than apps/api pins.
  modulePaths: ['<rootDir>/apps/api/node_modules'],
  testTimeout: 30000,
};
