import { configDataStore } from "src/stores/configDataStore";
import { useColorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import useWebSocket from "src/services/websocket.js";

export default async function initializeStores() {
  const controllers = useControllersStore();
  console.log(
    "initializing stores for ",
    controllers.currentController["hostname"],
  );

  const configStore = configDataStore();
  const colorStore = useColorDataStore();
  const infoStore = infoDataStore();
  const presetStore = useAppDataStore();
  const webSocket = useWebSocket();

  if (controllers.currentController) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> requesting websocket for ", url);
    webSocket.connect(url);

    try {
      //await controllers.fetchData();
      await infoStore.fetchData();
      await colorStore.fetchData();
      await configStore.fetchData();
      await presetStore.fetchData();
      await controllers.fetchData();
    } catch (error) {
      console.log("error initializing stores: ", error);
    }
  }
}
