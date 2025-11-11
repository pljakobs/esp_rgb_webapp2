import { boot } from "quasar/wrappers";
import svgIcon from "src/components/svgIcon.vue";
import mySelect from "src/components/mySelect.vue";

// Preload the icon sprite for performance
const preloadIconSprite = () => {
  const spriteUrl = "icons/iconsSprite.svg";
  const spriteId = "svg-icon-sprite";

  // Don't preload if already loaded
  if (document.getElementById(spriteId)) {
    return Promise.resolve();
  }

  console.log("🚀 Preloading icon sprite...");
  return fetch(spriteUrl, { cache: "default" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to preload sprite: ${response.status}`);
      }
      return response.text();
    })
    .then((spriteContent) => {
      const container = document.createElement("div");
      container.innerHTML = spriteContent.trim();
      const svgElement = container.querySelector("svg");

      if (svgElement) {
        svgElement.setAttribute("id", spriteId);
        svgElement.setAttribute("aria-hidden", "true");
        svgElement.style.position = "absolute";
        svgElement.style.width = "0";
        svgElement.style.height = "0";
        svgElement.style.overflow = "hidden";
        svgElement.style.visibility = "hidden";
        document.body.prepend(svgElement);
        console.log("✅ Icon sprite preloaded successfully");
      }
    })
    .catch((error) => {
      console.warn("⚠️ Failed to preload icon sprite:", error);
      // Non-critical error - components will load it on demand
    });
};

export default boot(({ app }) => {
  // Register components globally
  app.component("svgIcon", svgIcon);
  app.component("mySelect", mySelect);

  // Preload icon sprite for better performance
  preloadIconSprite();
});
