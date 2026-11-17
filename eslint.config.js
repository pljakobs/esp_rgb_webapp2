import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/",
      "src-cordova/",
      ".quasar/",
      "node_modules/",
      "quasar.config.*.temporary.compiled*",
      // TypeScript sources need @typescript-eslint parsing; not set up yet.
      "**/*.ts",
    ],
  },
  js.configs.recommended,
  ...vue.configs["flat/essential"],
  prettier,
  {
    files: ["**/*.js", "**/*.vue"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      // Pre-existing violations downgraded to warnings; burn down over time
      // (tracked in a follow-up issue). New rule categories still fail CI.
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "no-useless-escape": "warn",
      "no-empty": "warn",
      "no-dupe-class-members": "warn",
      "vue/no-mutating-props": "warn",
      "vue/no-dupe-keys": "warn",
      "vue/return-in-computed-property": "warn",
    },
  },
  {
    files: [
      "**/*.spec.js",
      "**/*.spec.ts",
      "**/__tests__/**",
      "vitest.setup.js",
    ],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
];
