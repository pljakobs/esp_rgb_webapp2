import { defineStore } from "pinia";
import useWebSocket from "src/services/websocket";
import {
  configDataStore,
  colorDataStore,
  presetDataStore,
  infoDataStore,
  groupsDataStore,
  controllersStore,
} from "src/store";

export default function initializeStores() {
  const controllers = controllersStore();
  console.log(
    "initializing stores for ",
    controllers.currentController["hostname"],
  );

  const configStore = configDataStore();
  const colorStore = colorDataStore();
  const presetStore = presetDataStore();
  const infoStore = infoDataStore();
  const groupsData = groupsDataStore();
  const webSocket = useWebSocket();

  if (controllers.currentController) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> requesting websocket for ", url);
    webSocket.connect(url);

    colorStore.fetchData();
    configStore.fetchData();
    presetStore.fetchData();
    infoStore.fetchData();
    groupsData.fetchData();
    controllers.fetchData();
  }
}
