<template>
  <router-view />
</template>

<script>
import { onMounted, watch } from "vue";
import { controllersStore } from "src/store";

import initializeStores from "src/services/initializeStores";

export default {
  name: "App",
  setup() {
    const controllers = controllersStore();
    const { webSocketState } = initializeStores();

    const webhost = window.location.hostname;
    console.log("webhost", webhost);
    watch(
      () => controllers.currentController,
      () => {
        console.log(
          "switching to controller",
          controllers.currentController["hostname"],
        );
        console.log(
          "current websocket state",
          webSocketState.socket.url,
          webSocketState.socket.isOpen,
        );
        if (webSocketState && webSocketState.socket.isOpen) {
          console.log("closing websocket to", webSocketState.url);
          webSocketState.destroy();
        }
        initializeStores();
      },
    );
    onMounted(() => {
      initializeStores();
    });
    return { webSocketState };
  },
};
</script>
