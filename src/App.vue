<template>
  <router-view />
</template>

<script>
import { onMounted, watch, defineComponent } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import initializeStores from "src/services/initializeStores";
import initializeNotifications from "src/services/notifications";
import initializeAppCommands from "src/services/appCommands";
import initializeLogService from "src/services/logServices";
import { useQuasar } from "quasar";

export default defineComponent({
  name: "App",
  setup() {
    console.log("starting app setup function");
    try {
      const controllers = useControllersStore();
      const $q = useQuasar(); // Get Quasar's global instance
      let initInFlight = false;

      console.log("controllers:", controllers);

      const webhost = window.location.hostname;
      console.log("webhost", webhost);

      const runInitializeStores = async () => {
        if (initInFlight) {
          return;
        }
        initInFlight = true;
        try {
          await initializeStores();
        } finally {
          initInFlight = false;
        }
      };

      watch(
        () => controllers.currentController?.ip_address,
        (newIp, oldIp) => {
          // Ignore the first resolution from null/undefined to avoid a second
          // startup initialization burst while the first one is still running.
          if (!oldIp || !newIp) {
            return;
          }
          if (newIp && newIp !== oldIp) {
            console.log(
              "switching to controller",
              controllers.currentController.hostname,
            );
            runInitializeStores();
          }
        },
      );

      onMounted(async () => {
        window.sessionStorage.removeItem(
          "rgbww:reloaded-after-chunk-load-error",
        );

        await runInitializeStores();
        initializeNotifications();
        initializeAppCommands();
        initializeLogService();

        // Setup fullscreen for mobile devices
        if ($q.platform.is.mobile) {
          console.log("Mobile device detected, enabling fullscreen mode");

          // Attempt to go fullscreen after a user interaction (required by browsers)
          const handleUserInteraction = () => {
            if ($q.fullscreen?.isCapable) {
              $q.fullscreen.toggle();
              console.log("Toggling fullscreen mode");
            } else {
              console.log("Fullscreen not supported on this device");
            }

            // Remove event listeners after first interaction
            document.removeEventListener("click", handleUserInteraction);
            document.removeEventListener("touchstart", handleUserInteraction);
          };

          document.addEventListener("click", handleUserInteraction);
          document.addEventListener("touchstart", handleUserInteraction);
        }
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
  errorCaptured(err, vm, info) {
    console.error(`Error in component: ${vm.$options.name}`);
    console.error(err);
    return false; // Prevent the error from propagating further
  },
});
</script>

<style>
/* Add any necessary global styles here */
</style>
