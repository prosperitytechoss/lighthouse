import config from "@lighthouse/eslint-config";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    // Browser globals (the shared config is tuned for React Native).
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
