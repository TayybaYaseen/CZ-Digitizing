// jest-expo's own transformIgnorePatterns assumes a flat (npm/yarn-classic) node_modules layout
// ("node_modules/(?!react-native|@react-native...)"). pnpm instead nests every package under
// node_modules/.pnpm/<name>@<version>/node_modules/<name>/..., so that regex's first
// "node_modules/" match is followed by ".pnpm/", which never matches the allow-list and the whole
// package gets (wrongly) skipped — including react-native's own Flow-syntax internals, which then
// fail to parse. Overriding to an empty allow-list (transform everything) sidesteps the mismatch;
// slower, but correct regardless of node_modules layout.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  transformIgnorePatterns: [],
};
