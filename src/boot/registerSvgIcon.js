import { boot } from "quasar/wrappers";
import svgIcon from "src/components/svgIcon.vue";
import mySelect from "src/components/mySelect.vue";

export default boot(({ app }) => {
  // Register components globally
  app.component("svgIcon", svgIcon);
  app.component("mySelect", mySelect);
});
