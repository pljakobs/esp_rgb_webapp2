import { configDataStore } from "src/stores/configDataStore";
import { colorDataStore } from "src/stores/colorDataStore";
import { presetDataStore } from "src/stores/presetDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { controllersStore } from "src/stores/controllersStore";
import useWebSocket from "src/services/websocket.js";

export default async function initializeStores() {
  const controllers = controllersStore();
  console.log(
    "initializing stores for ",
    controllers.currentController["hostname"],
  );

  const configStore = configDataStore();
  const colorStore = colorDataStore();
  const infoStore = infoDataStore();
  const presetStore = presetDataStore();
  const webSocket = useWebSocket();

  if (controllers.currentController) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> requesting websocket for ", url);
    webSocket.connect(url);

    try {
      //await controllers.fetchData();
      await colorStore.fetchData();
      await configStore.fetchData();
      await infoStore.fetchData();
      await presetStore.fetchData();
      await controllers.fetchData();
    } catch (error) {
      console.log("error initializing stores: ", error);
    }
  }
}
