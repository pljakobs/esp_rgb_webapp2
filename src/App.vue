<template>
  <router-view />
</template>

<script>
import { defineComponent } from "vue";
import { onMounted, watch } from "vue";
import { controllersStore } from "src/stores/controllersStore";

import initializeStores from "src/services/initializeStores";

export default defineComponent({
  name: "App",
  setup() {
    const controllers = controllersStore();

    const webhost = window.location.hostname;
    console.log("webhost", webhost);
    watch(
      () => controllers.currentController,
      () => {
        console.log(
          "switching to controller",
          controllers.currentController["hostname"]
        );
        initializeStores();
      }
    );
    onMounted(() => {
      initializeStores();
    });
  },
});
</script>
