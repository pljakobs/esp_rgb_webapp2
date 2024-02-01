import { defineStore } from "pinia";
import useWebSocket, { wsStatus } from "src/services/websocket.js";
import {
  configDataStore,
  colorDataStore,
  presetDataStore,
  infoDataStore,
  groupsDataStore,
  controllersStore,
  storeStatus,
} from "src/store";

export default function initializeStores() {
  const controllers = controllersStore();
  console.log(
    "initializing stores for ",
    controllers.currentController["hostname"],
  );

  const configStore = configDataStore();
  const colorStore = colorDataStore();
  const infoStore = infoDataStore();
  const groupsData = groupsDataStore();
  const presets = presetDataStore();
  const webSocket = useWebSocket();

  if (controllers.currentController) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> requesting websocket for ", url);
    webSocket.connect(url);

    async function initializeStores() {
      try {
        await controllers.fetchData();
        await colorStore.fetchData();
        await configStore.fetchData();
        await infoStore.fetchData();
        await presets.fetchData();
        //groupsData.fetchData();
        groupsData.status = storeStatus.READY;
        await controllers.fetchData();
      } catch (error) {
        console.log("error initializing stores: ", error);
      }
    }
    initializeStores();
  }
}
