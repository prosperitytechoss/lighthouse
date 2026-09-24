// Shared flat ESLint config for all Lighthouse apps and packages.
// Built on the Expo preset + Prettier. Import and spread in each app's eslint.config.js.
import expoConfig from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...expoConfig,
  prettier,
  {
    rules: {
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    ignores: ["dist/**", ".expo/**", ".turbo/**", "android/**", "ios/**", "node_modules/**"],
  },
];
