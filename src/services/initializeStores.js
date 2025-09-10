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
  const appDataStore = useAppDataStore();
  const webSocket = useWebSocket();

  if (controllers.currentController) {
    const url = "ws://" + controllers.currentController["ip_address"] + "/ws";
    console.log("=> requesting websocket for ", url);
    webSocket.connect(url);

    try {
      // Fetch controllers data first
      await controllers.fetchData();

      // Then fetch the rest in parallel
      await Promise.all([
        infoStore.fetchData(),
        colorStore.fetchData(),
        configStore.fetchData(),
        appDataStore.fetchData(),
      ]);

      // Now set up the watchers for synchronization
      console.log("All stores initialized, setting up sync watcher");
      appDataStore.watchForSync();
    } catch (error) {
      console.log("error initializing stores: ", error);
    }
  }
}
