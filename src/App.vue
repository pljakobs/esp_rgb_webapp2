<template>
  <router-view />
</template>

<script>
import { onMounted } from "vue";
import { defineStore } from "pinia";
import {
  configDataStore,
  colorDataStore,
  presetDataStore,
  infoDataStore,
  groupsDataStore,
} from "src/store";

export default {
  name: "App",
  setup() {
    const configStore = configDataStore();
    const colorStore = colorDataStore();
    const presetStore = presetDataStore();
    const infoStore = infoDataStore();
    const groupsData = groupsDataStore();
    onMounted(() => {
      colorStore.fetchData();
      configStore.fetchData();
      presetStore.fetchData();
      infoStore.fetchData();
      groupsData.fetchData();
    });
  },
};
</script>
