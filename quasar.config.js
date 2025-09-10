import { configure } from 'quasar/wrappers';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default configure((/* ctx */) => {
  return {
    eslint: {
      warnings: true,
      errors: true,
    },
    boot: ['i18n', 'registerSvgIcon.js'],
    css: ['app.scss'],
    extras: [],
    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node18',
      },
      useFilenameHashes: false,
      vueRouterMode: 'hash',
      rebuildCache: true,
      minify: true,
      polyfillModulePreload: true,
      sourcemap: false,
      vitePlugins: [
        {
          include: path.resolve('./src/i18n/**'),
        },
        visualizer({
          filename: './dist/stats.json',
          json: true,
        }),
      ],
    },
    devServer: {
      open: true,
    },
    framework: {
      config: {
        brand: { font: 'sans-serif' },
      },
      plugins: ['Notify', 'Dialog'],
      lang: 'en-US',
    },
    animations: [],
  };
});
