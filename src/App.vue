<template>
  <router-view />
</template>

<script>
import { onMounted } from "vue";
import { defineStore } from "pinia";
import useWebSocket from "src/services/websocket";
import {
  configDataStore,
  colorDataStore,
  presetDataStore,
  infoDataStore,
  groupsDataStore,
  controllerIpAddress, // this will be a dynamic address later
} from "src/store";

export default {
  name: "App",
  setup() {
    const configStore = configDataStore();
    const colorStore = colorDataStore();
    const presetStore = presetDataStore();
    const infoStore = infoDataStore();
    const groupsData = groupsDataStore();
    const webSocketState = useWebSocket(`ws://${controllerIpAddress}/ws`);

    onMounted(() => {
      colorStore.fetchData();
      colorStore.setupWebSocket();
      colorStore.setupWebSocket(webSocketState); // pass the websocket state to the store
      configStore.fetchData();
      presetStore.fetchData();
      infoStore.fetchData();
      groupsData.fetchData();
    });

    return { webSocketState };
  },
};
</script>
