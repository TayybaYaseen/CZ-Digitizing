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
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
