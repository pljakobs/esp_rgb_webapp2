import { configure } from "quasar/wrappers";
import fs from "node:fs";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { execSync } from "node:child_process";
import zlib from "node:zlib";

const runIconGeneration = () => {
  execSync("node generate_icon_list.js", { stdio: "inherit" });
};

let iconSpriteGeneratedInServe = false;

const compressibleExts = new Set([".html", ".js", ".css", ".map", ".svg"]);

const brotliOptions = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
  },
};

const runBrotliSpa = () => {
  const distDir = path.resolve(process.cwd(), "dist/spa");
  if (!fs.existsSync(distDir)) {
    return;
  }

  const pruneLegacyArtifacts = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        pruneLegacyArtifacts(fullPath);
        return;
      }

      if (fullPath.toLowerCase().endsWith(".gz")) {
        fs.rmSync(fullPath);
      }
    });
  };

  const compressDir = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        compressDir(fullPath);
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      if (!compressibleExts.has(ext) || fullPath.toLowerCase().endsWith(".br")) {
        return;
      }

      const source = fs.readFileSync(fullPath);
      const compressed = zlib.brotliCompressSync(source, brotliOptions);
      fs.writeFileSync(`${fullPath}.br`, compressed);
      fs.rmSync(fullPath);
    });
  };

  pruneLegacyArtifacts(distDir);
  compressDir(distDir);
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
      runBrotliSpa();
      runIconGeneration();
    },
  };

  return {
    eslint: {
      warnings: true,
      errors: true,
    },
    boot: ["i18n", "registerSvgIcon.js"],
    css: ["app.scss"],
    extras: [],
    build: {
      target: {
        browser: ["es2019", "edge88", "firefox78", "chrome87", "safari13.1"],
        node: "node18",
      },
      useFilenameHashes: false,
      vueRouterMode: "hash",
      rebuildCache: true,
      minify: true,
      polyfillModulePreload: true,
      sourcemap: false,
      vitePlugins: [
        generateIconSpriteServePlugin,
        generateIconSpriteBuildPlugin,
        {
          include: path.resolve("./src/i18n/**"),
        },
        visualizer({
          filename: "./dist/stats.json",
          json: true,
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
