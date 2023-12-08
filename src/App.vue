<template>
  <router-view />
</template>

<script>
import { onMounted } from "vue";
import { defineStore } from "pinia";
import { configDataStore, colorDataStore } from "src/store";

export default {
  name: "App",
  setup() {
    const configStore = configDataStore();
    const colorStore = colorDataStore();
    const presetStore = presetDataStore;
    onMounted(() => {
      colorStore.fetchData();
      configStore.fetchData();
      presetStore.fetchData();
    });
  },
};
</script>
