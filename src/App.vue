<template>
  <router-view />
</template>

<script>
import { onMounted, watch, defineComponent } from "vue";
import { controllersStore } from "src/stores/controllersStore";
import initializeStores from "src/services/initializeStores";
import { Dark } from "quasar";

export default defineComponent({
  name: "App",
  setup() {
    try {
      const controllers = controllersStore();
      console.log("controllers:", controllers);

      const webhost = window.location.hostname;
      console.log("webhost", webhost);

      watch(
        () => controllers.currentController,
        () => {
          console.log(
            "switching to controller",
            controllers.currentController?.hostname,
          );
          initializeStores();
        },
      );

      onMounted(() => {
        initializeStores();
      });
    } catch (error) {
      console.error("Error in setup function:", error);
    }
  },
  watch: {
    "$q.dark.isActive": {
      handler(isDark) {
        document.documentElement.setAttribute(
          "data-theme",
          isDark ? "dark" : "light",
        );
      },
      immediate: true,
    },
  },
});
</script>

<style>
/* Add any necessary global styles here */
</style>
