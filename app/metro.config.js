// Metro config for the npm-workspaces monorepo. Lets the app import the
// @usual/* TypeScript packages straight from source (packages/*/src).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/* trigger reloads.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Only look in the paths above (avoids picking up stray parent node_modules).
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
