import { configDataStore } from "src/stores/configDataStore";
import { useColorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";
import useWebSocket from "src/services/websocket.js";

const INIT_DELAYS = {
  controllers: 0,
  websocket: 750,
  storeStart: 1500,
  betweenStores: 250,
  sync: 2000,
};

let controllersLoaded = false;
let lastControllerKey = null;
const storeCacheKeys = {
  info: null,
  color: null,
  config: null,
  appData: null,
};
let activeInitToken = 0;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));

export default async function initializeStores(options = {}) {
  const { force = false } = options;

  const controllers = useControllersStore();
  const configStore = configDataStore();
  const colorStore = useColorDataStore();
  const infoStore = infoDataStore();
  const appDataStore = useAppDataStore();
  const webSocket = useWebSocket();

  if (!controllers.currentController) {
    console.warn("No current controller selected; skipping store init");
    return;
  }

  activeInitToken += 1;
  const initToken = activeInitToken;

  const isStale = () => initToken !== activeInitToken;

  const safeDelay = async (ms) => {
    if (ms <= 0) {
      return true;
    }
    await sleep(ms);
    return !isStale();
  };

  try {
    if (!(await safeDelay(INIT_DELAYS.controllers))) {
      return;
    }

    const shouldFetchControllers = force || !controllersLoaded;
    if (shouldFetchControllers) {
      console.log("Fetching controllers data (force:", force, ")");
      await controllers.fetchData();
      if (isStale()) {
        return;
      }
      if (controllers.status === storeStatus.READY) {
        controllersLoaded = true;
      }
    }

    const activeController = controllers.currentController;
    if (!activeController || !activeController.ip_address) {
      console.warn("Controller has no IP address; aborting store init");
      return;
    }

    const controllerKey = `${activeController.hostname}|${activeController.ip_address}`;
    if (controllerKey !== lastControllerKey) {
      console.log("Controller changed, resetting store caches");
      lastControllerKey = controllerKey;
      Object.keys(storeCacheKeys).forEach((key) => {
        storeCacheKeys[key] = null;
      });
    }

    if (!(await safeDelay(INIT_DELAYS.websocket))) {
      return;
    }

    const targetUrl = `ws://${activeController.ip_address}/ws`;
    const currentUrl = webSocket.url?.value;
    if (currentUrl && currentUrl !== targetUrl) {
      console.log("Switching websocket connection to", targetUrl);
      webSocket.destroy();
    }
    webSocket.connect(targetUrl);

    if (!(await safeDelay(INIT_DELAYS.storeStart))) {
      return;
    }

    const storeSteps = [
      {
        key: "info",
        store: infoStore,
        fetch: () => infoStore.fetchData(),
      },
      {
        key: "color",
        store: colorStore,
        fetch: () => colorStore.fetchData(),
      },
      {
        key: "config",
        store: configStore,
        fetch: () => configStore.fetchData(),
      },
      {
        key: "appData",
        store: appDataStore,
        fetch: () => appDataStore.fetchData(),
      },
    ];

    for (const step of storeSteps) {
      if (isStale()) {
        return;
      }

      const shouldFetch = force || storeCacheKeys[step.key] !== controllerKey;

      if (shouldFetch) {
        try {
          await step.fetch();
          if (step.store.status === storeStatus.READY) {
            storeCacheKeys[step.key] = controllerKey;
          }
        } catch (error) {
          console.error(`Failed to initialize ${step.key} store:`, error);
        }
      }

      if (!(await safeDelay(INIT_DELAYS.betweenStores))) {
        return;
      }
    }

    if (!(await safeDelay(INIT_DELAYS.sync))) {
      return;
    }

    appDataStore.watchForSync();
  } catch (error) {
    console.error("error initializing stores:", error);
  }
}
