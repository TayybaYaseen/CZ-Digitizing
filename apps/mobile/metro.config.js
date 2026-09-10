// pnpm's node_modules are symlinks into its content-addressable store, which Metro (React
// Native's bundler) does not follow by default — every transitive dependency (e.g.
// @babel/runtime, resolved from apps/mobile/node_modules/@babel/runtime, itself a symlink into
// node_modules/.pnpm/...) fails to resolve with a "Module does not exist" error even though the
// file is genuinely present. `unstable_enableSymlinks` + watching the monorepo root (so Metro's
// Haste map covers the pnpm store, not just apps/mobile/) is the standard fix for Expo + pnpm
// monorepos. See https://docs.expo.dev/guides/monorepos/.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];
config.resolver.unstable_enableSymlinks = true;
// The pnpm store holds two "react" versions (this app pins 18.2.0 for Expo SDK 51 compatibility;
// apps/web/apps/admin use 18.3.1) since Metro watches the whole workspace root above. Most of this
// app's own code resolves "react" correctly to 18.2.0 via pnpm's per-package peer resolution, but
// expo's *own* internal modules (e.g. expo/build/environment/DevLoadingView.js) sit in a single
// shared pnpm-store instance whose own hierarchical lookup happens to land on 18.3.1 — verified by
// inspecting the built bundle's module map, which showed exactly one module (DevLoadingView.js)
// requiring the wrong react copy while everything else used 18.2.0. Two live React instances in one
// bundle break hooks entirely ("Cannot read properties of null (reading 'useState')") since
// context/dispatcher state isn't shared across copies. `extraNodeModules` alone does NOT fix this —
// it's only a last-resort fallback Metro checks *after* hierarchical lookup already succeeded (even
// at the wrong path), so it silently does nothing here. Resolve each singleton to one concrete file
// via Node's own require.resolve and hand that back directly — "scheduler" isn't a direct dependency
// of apps/mobile (only of react-dom), so it's resolved starting from react-dom's own install
// directory rather than apps/mobile's, matching how it's actually reachable on disk.
const reactDomDir = path.dirname(require.resolve('react-dom', { paths: [projectRoot] }));
const singletonModulePaths = {
  react: require.resolve('react', { paths: [projectRoot] }),
  'react-dom': require.resolve('react-dom', { paths: [projectRoot] }),
  'react-native': require.resolve('react-native', { paths: [projectRoot] }),
  scheduler: require.resolve('scheduler', { paths: [reactDomDir] }),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolvedPath = singletonModulePaths[moduleName];
  if (resolvedPath) return { type: 'sourceFile', filePath: resolvedPath };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
