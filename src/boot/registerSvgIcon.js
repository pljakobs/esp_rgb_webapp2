import { boot } from "quasar/wrappers";
import svgIcon, { ensureSpriteLoaded } from "src/components/svgIcon.vue";
import mySelect from "src/components/mySelect.vue";
import ControllerProgressDisplay from "src/components/Dialogs/ControllerProgressDisplay.vue";

function scheduleSpritePrefetch() {
  if (typeof window === "undefined") {
    return;
  }

  const prefetch = () => {
    ensureSpriteLoaded().catch((error) => {
      console.warn("svg sprite prefetch failed, will retry on first icon use", error);
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(prefetch, { timeout: 1500 });
  } else {
    window.setTimeout(prefetch, 150);
  }
}

export default boot(({ app }) => {
  // Prefetch icon sprite when the main thread is idle to avoid extra startup contention.
  scheduleSpritePrefetch();
  // Register components globally
  app.component("svgIcon", svgIcon);
  app.component("mySelect", mySelect);
  app.component("ControllerProgressDisplay", ControllerProgressDisplay);
});
