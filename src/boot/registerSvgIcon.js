import { boot } from "quasar/wrappers";
import svgIcon, { ensureSpriteLoaded } from "src/components/svgIcon.vue";
import mySelect from "src/components/mySelect.vue";
import ControllerProgressDisplay from "src/components/Dialogs/ControllerProgressDisplay.vue";

export default boot(({ app }) => {
  // Pre-fetch SVG sprite once from the main bundle before any lazy chunks render
  ensureSpriteLoaded();
  // Register components globally
  app.component("svgIcon", svgIcon);
  app.component("mySelect", mySelect);
  app.component("ControllerProgressDisplay", ControllerProgressDisplay);
});
