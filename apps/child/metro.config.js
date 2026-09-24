// Metro config for the child app inside the pnpm monorepo. See parent app for notes.
const path = require("path");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// inlineRem: 16 is required by React Native Reusables.
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
