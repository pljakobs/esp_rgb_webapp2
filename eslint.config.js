const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const vue = require("eslint-plugin-vue");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = (async () => {
  const standard = await import("@vue/eslint-config-standard");

  return [
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
        "src-capacitor/",
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
})();
