import config from "@lighthouse/eslint-config";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    // Node backend globals (the shared config is tuned for React Native).
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "writable",
        exports: "writable",
      },
    },
  },
  {
    ignores: ["dist/**", "drizzle/**", "node_modules/**"],
  },
];
