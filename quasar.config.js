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
      viteVuePluginOptions: {},

      extendViteConf(viteConf) {
        viteConf.build = {
          ...viteConf.build,
          // Enable more aggressive minification
          minify: "terser",
          terserOptions: {
            compress: {
              drop_console: false, // Remove console.log statements
              drop_debugger: true,
              pure_funcs: ["console.info", "console.debug"],
            },
          },
          // CSS minification
          cssCodeSplit: true,
          cssMinify: true,
          // Reduce chunk size
          chunkSizeWarningLimit: 500,
        };
      },
    },
    devServer: {
      open: true,
    },
    framework: {
      config: {
        brand: { font: "sans-serif" },
      },
      plugins: ["Notify", "Dialog", "Loading", "LocalStorage"],
      lang: "en-US",
      components: [
        // Layout & Structure
        "QLayout",
        "QHeader",
        "QDrawer",
        "QPageContainer",
        "QPage",
        "QToolbar",
        "QToolbarTitle",
        "QFooter",
        "QPageSticky",

        // Navigation
        "QBtn",
        "QBtnToggle",
        "QBtnDropdown",
        "QTabs",
        "QTab",
        "QRouteTab",
        "QTabPanels",
        "QTabPanel",

        // Form Components
        "QInput",
        "QSelect",
        "QCheckbox",
        "QToggle",
        "QSlider",
        "QRange",
        "QColor",
        "QOptionGroup",
        "QRadio",

        // Cards & Lists
        "QCard",
        "QCardSection",
        "QCardActions",
        "QList",
        "QItem",
        "QItemSection",
        "QItemLabel",
        "QExpansionItem",
        "QSeparator",

        // Display
        "QBadge",
        "QChip",
        "QIcon",
        "QAvatar",
        "QTooltip",
        "QBanner",
        "QMenu",
        "QLinearProgress",
        "QCircularProgress",
        "QInnerLoading",
        "QSpinner",
        "QSkeleton",

        // Data Display
        "QTable",
        "QTh",
        "QTr",
        "QTd",
        "QMarkupTable",

        // Dialogs & Popups
        "QDialog",
        "QPopupProxy",

        // Scrolling
        "QScrollArea",

        // Utilities
        "QSpace",
        "QScrollObserver",
        "QResizeObserver",
      ],

      directives: ["ClosePopup", "Ripple", "TouchSwipe"],
    },
    animations: [],
  };
});
