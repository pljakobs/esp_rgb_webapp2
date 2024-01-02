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
  ("");
  console.log(
    "initializing stores for ",
    controllers.currentController["hostname"],
  );

  const configStore = configDataStore();
  const colorStore = colorDataStore();
  const presetStore = presetDataStore();
  const infoStore = infoDataStore();
  const groupsData = groupsDataStore();
  if (controllers.currentController !== undefined) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> openening websocket for ", url);
    const webSocketState = useWebSocket(url);

    colorStore.fetchData();
    colorStore.setupWebSocket(webSocketState); // pass the websocket state to the store
    configStore.fetchData();
    presetStore.fetchData();
    infoStore.fetchData();
    groupsData.fetchData();
    controllers.fetchData();

    return { webSocketState };
  }
}
