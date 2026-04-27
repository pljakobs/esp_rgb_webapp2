import { configure } from "quasar/wrappers";
import fs from "node:fs";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { execSync } from "node:child_process";

const runIconGeneration = () => {
  execSync("node generate_icon_list.js", { stdio: "inherit" });
};

let iconSpriteGeneratedInServe = false;

const runGzipSpa = () => {
  const distDir = path.resolve(process.cwd(), "dist/spa");
  if (!fs.existsSync(distDir)) {
    return;
  }

  execSync("bash ./gzipSPA.sh", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
};

export default configure((/* ctx */) => {
  const generateIconSpriteServePlugin = {
    name: "generate-icon-sprite-serve",
    apply: "serve",
    buildStart() {
      if (iconSpriteGeneratedInServe) {
        return;
      }
      runIconGeneration();
      iconSpriteGeneratedInServe = true;
    },
  };

  const generateIconSpriteBuildPlugin = {
    name: "generate-icon-sprite-build",
    apply: "build",
    closeBundle() {
      runGzipSpa();
      runIconGeneration();
    },
  };

  return {
    eslint: {
      warnings: true,
      errors: true,
    },
    boot: ["registerSvgIcon.js", "autosaveFeedback"],
    css: ["app.scss"],
    extras: [],
    build: {
      cssMinify: "esbuild",
      minify: "esbuild",
      target: {
        browser: ["es2022"],
        node: "node24",
      },
      extendViteConf(viteConf) {
        viteConf.server ??= {};
        viteConf.server.watch ??= {};
        viteConf.server.watch.usePolling = true;
        viteConf.server.watch.interval = 200;
        viteConf.build.polyfillDynamicImport = false;
        viteConf.build.rollupOptions = {
          output: {
            // This forces all dependencies and code into index.js
            manualChunks: undefined,
          },
        };
        viteConf.build.modulePreload = { polyfill: false };
      },
      // Static asset names allow browsers to reuse stale chunks after firmware/webapp
      // updates, which can break ESM imports when minified export aliases change.
      useFilenameHashes: true,
      vueRouterMode: "hash",
      rebuildCache: true,
      polyfillModulePreload: false,
      sourcemap: false,
      vitePlugins: [
        generateIconSpriteServePlugin,
        generateIconSpriteBuildPlugin,
        visualizer({
          filename: "./dist/stats.html",
          template: "treemap", // or "sunburst", "network"
        }),
      ],
    },
    devServer: {
      open: true,
    },
    framework: {
      config: {
        brand: { font: "sans-serif" },
      },
      plugins: ["Notify", "Dialog"],
      lang: "en-US",
    },
    animations: [],
  };
});
