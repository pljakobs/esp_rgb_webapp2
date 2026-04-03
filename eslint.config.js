import { FlatCompat } from "@eslint/eslintrc";
import vue from "eslint-plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const standard = await import("@vue/eslint-config-standard");

export default [
  {
    files: ["**/*.js", "**/*.vue"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        node: true,
      },
    },
    plugins: {
      vue,
    },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    },
    ignores: [
      "dist/",
      "src-cordova/",
      ".quasar/",
      "node_modules/",
      ".eslintrc.js",
      "quasar.config.*.temporary.compiled*",
    ],
  },
  ...compat.extends("plugin:vue/vue3-essential"),
  ...compat.extends("eslint:recommended"),
  ...compat.extends(standard.default),
];
