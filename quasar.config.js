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
      runIconGeneration();
      runGzipSpa();
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
        // Fix path resolution using Node compile-time directory context
        viteConf.resolve ??= {};
        viteConf.resolve.alias = {
          ...viteConf.resolve.alias,
          src: path.resolve(__dirname, "./src"),
          pages: path.resolve(__dirname, "./src/pages"),
          components: path.resolve(__dirname, "./src/components"),
          stores: path.resolve(__dirname, "./src/stores"),
          layouts: path.resolve(__dirname, "./src/layouts"),
        };

        // Suppress browser runtime references to Node global process objects
        viteConf.define ??= {};
        viteConf.define = {
          ...viteConf.define,
          "process.env": "{}",
          "process.cwd": '"/"',
        };

        viteConf.server ??= {};
        viteConf.server.watch ??= {};
        viteConf.server.watch.usePolling = true;
        viteConf.server.watch.interval = 200;

        // Dynamic imports configuration for chunked loading
        viteConf.build.polyfillDynamicImport = true;
        viteConf.build.rollupOptions = {
          output: {
            // Chunk splitting is active to separate pages and vendor libraries
          },
        };
        viteConf.build.cssMinify = "esbuild";
        viteConf.build.modulePreload = { polyfill: true };
      },
      useFilenameHashes: true,
      vueRouterMode: "hash",
      rebuildCache: true,
      polyfillModulePreload: true,
      sourcemap: false,
      vitePlugins: [
        generateIconSpriteServePlugin,
        generateIconSpriteBuildPlugin,
        visualizer({
          filename: "./dist/stats.html",
          template: "treemap",
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
