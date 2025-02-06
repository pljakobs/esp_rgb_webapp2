import { boot } from "quasar/wrappers";
import svgIcon from "src/components/svgIcon.vue";

export default boot(({ app }) => {
  // Register svgIcon globally
  app.component("svgIcon", svgIcon);
});
