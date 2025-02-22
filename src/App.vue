<template>
  <router-view />
</template>

<script>
import { onMounted, watch, defineComponent } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import initializeStores from "src/services/initializeStores";
import initializeNotifications from "src/services/notifications";
import initizalizeAppCommands from "src/services/appCommands";
import { Dark } from "quasar";
import initializeAppCommands from "src/services/appCommands";
import initializeLogService from "src/services/logServices";

export default defineComponent({
  name: "App",
  setup() {
    try {
      const controllers = useControllersStore();
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
        initializeNotifications();
        initializeAppCommands();
        initializeLogService();
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
