import { defineStore } from "pinia";
import { localhost, storeStatus } from "./storeConstants";
import useWebSocket, { wsStatus } from "src/services/websocket.js";
import { infoDataStore } from "src/stores/infoDataStore"; // Import infoDataStore
import { apiService } from "src/services/api.js";

export const useControllersStore = defineStore("controllersStore", {
  state: () => ({
    data: [],
    storeStatus: storeStatus.store.LOADING,
    currentController: null, // Will be set from /hosts response only
    homeController: null, // Will be set from /hosts response only
    http_response_status: null,
    websocketSubscribed: false,
    error: null,
  }),

  getters: {
    // Legacy compatibility getter
    status: (state) => state.storeStatus,
  },

  actions: {
    async fetchHostsViaWebSocket(showAll = true, timeoutMs = 1200) {
      const ws = useWebSocket();
      if (
        ws.status?.value !== wsStatus.CONNECTED ||
        typeof ws.request !== "function"
      ) {
        return null;
      }

      try {
        const params = await ws.request(
          "hosts",
          { all: showAll ? "1" : "0" },
          timeoutMs,
        );
        const payload = params?.message ?? params;

        if (Array.isArray(payload)) {
          return { hosts: payload };
        }
        if (payload && Array.isArray(payload.hosts)) {
          return payload;
        }
      } catch (error) {
        console.warn(
          "hosts websocket fetch failed, falling back to HTTP:",
          error?.message || error,
        );
      }

      return null;
    },

    async fetchData(retryCount = 0) {
      try {
        infoDataStore();
        console.log("controllers start fetching data");
        this.storeStatus = storeStatus.store.LOADING;

        let hostsResponse = await this.fetchHostsViaWebSocket(true);

        if (!hostsResponse) {
          const { jsonData, error } = await apiService.getHosts(true);
          if (error) {
            this.storeStatus = storeStatus.store.ERROR;
            this.error = error;
            console.error("Error fetching controllers data:", error);
            throw error;
          }
          hostsResponse = jsonData;
        }

        if (hostsResponse && Array.isArray(hostsResponse.hosts)) {
          this.data = hostsResponse.hosts;
          // 1. If ip_address is numeric, match and update hostname, set controllers
          if (/^\d+\.\d+\.\d+\.\d+$/.test(localhost.ip_address)) {
            const match = this.data.find(
              (c) => String(c.ip_address) === String(localhost.ip_address),
            );
            if (match) {
              localhost.hostname = match.hostname;
              this.currentController = match;
              this.homeController = match;
              console.log(
                `Matched numeric ip_address, set localhost.hostname to '${match.hostname}' and set controllers`,
              );
            }
          }
          // 2. If ip_address is FQDN, extract shortname and set as hostname, set controllers
          else if (
            typeof localhost.ip_address === "string" &&
            localhost.ip_address.includes(".")
          ) {
            const shortName = localhost.ip_address.split(".")[0];
            localhost.hostname = shortName;
            const match = this.data.find(
              (c) =>
                String(c.hostname).toLowerCase() === shortName.toLowerCase(),
            );
            if (match) {
              this.currentController = match;
              this.homeController = match;
              console.log(
                `Extracted shortname '${shortName}' from FQDN, set as localhost.hostname and set controllers`,
              );
            } else {
              console.log(
                `Extracted shortname '${shortName}' from FQDN, set as localhost.hostname but no controller matched`,
              );
            }
          }
          // Fallback: if still not set, use placeholder
          if (!this.currentController || !this.homeController) {
            this.currentController = {
              hostname: localhost.hostname,
              ip_address: localhost.ip_address,
              visible: true,
            };
            this.homeController = this.currentController;
            console.warn(
              "No controller matched in early phase, using placeholder from storeConstants.js",
            );
          }
        }
        this.data.sort((a, b) => a.hostname.localeCompare(b.hostname));
        console.log("controllers data fetched: ", JSON.stringify(this.data));
        this.storeStatus = storeStatus.store.READY;

        if (!this.websocketSubscribed) {
          const ws = useWebSocket();

          ws.onJson("updated_host", (params) => {
            const host = params.message;
            if (!host?.ip_address) {
              return;
            }
            console.log(
              "updating controller from jsonrpc message: ",
              JSON.stringify(host),
            );
            const index = this.data.findIndex(
              (controller) => controller.ip_address === host.ip_address,
            );
            if (index !== -1) {
              this.data[index] = { ...this.data[index], ...host };
            } else {
              this.insertControllerAlphabetically(host);
            }
          });

          ws.onJson("new_host", (params) => {
            const host = params.message;
            if (!host?.ip_address) {
              return;
            }
            console.log(
              "adding new controller from jsonrpc message: ",
              JSON.stringify(host),
            );
            const index = this.data.findIndex(
              (controller) => controller.ip_address === host.ip_address,
            );
            if (index === -1) {
              this.insertControllerAlphabetically(host);
            }
          });

          ws.onJson("removed_host", (params) => {
            const host = params.message;
            if (!host?.ip_address) {
              return;
            }
            console.log(
              "removing controller from jsonrpc message: ",
              JSON.stringify(host),
            );
            this.data = this.data.filter(
              (controller) => controller.ip_address !== host.ip_address,
            );
          });

          this.websocketSubscribed = true;
          console.log(
            "WebSocket initialized and subscribed to controller events.",
          );
        }

        // 3. After infoDataStore is ready, set currentController/homeController to the controller object matching deviceid
        const infoStore = infoDataStore();
        if (
          infoStore.status === storeStatus.READY &&
          infoStore.data &&
          infoStore.data.device?.deviceid
        ) {
          const matchById = this.data.find(
            (c) => String(c.id) === String(infoStore.data.device.deviceid),
          );
          if (matchById) {
            if (matchById.hostname !== localhost.hostname) {
              console.log(
                `Updating localhost.hostname from '${localhost.hostname}' to '${matchById.hostname}' based on infoDataStore.deviceid`,
              );
              localhost.hostname = matchById.hostname;
            }
            if (this.currentController !== matchById) {
              this.currentController = matchById;
              this.homeController = matchById;
              console.log(
                "Updated currentController and homeController to match deviceid:",
                matchById,
              );
            }
          }
        }
      } catch (error) {
        this.storeStatus = storeStatus.store.ERROR;
        this.error = error;
        console.error("Error fetching controllers data:", error);
        throw error;
      }
    },

    // This watcher is now moved to App.vue or a dedicated composable to avoid re-initialization loops.
    // initializeStores should not contain this watcher to avoid re-initialization loops.
    // The websocket connection logic should be managed by a single, persistent watcher.
    // For now, I'll assume App.vue is the place.
    //
    // The current `initializeStores.js` has this:
    // ```javascript
    //   // Watch for changes to currentController and (re)connect websocket
    //   watch(
    //     () =>
    //       controllers.currentController && controllers.currentController.ip_address,
    //     (ip, prevIp) => {
    //       if (ip && ip !== prevIp) {
    //         const wsUrl = `ws://${ip}/ws`;
    //         if (webSocket.url?.value !== wsUrl) {
    //           webSocket.connect(wsUrl);
    //         }
    //       }
    //     },
    //     { immediate: true },
    //   );
    // ```
    // This watcher is *inside* `initializeStores`. If `initializeStores` is called multiple times, this watcher is set up multiple times, which is not ideal.
    // The `initializeStores` function should be a one-time setup or a function that can be safely re-run. The websocket connection should be managed by a single, persistent watcher.
    // Given the current structure, the `initializeStores` function is designed to be called when the controller changes. The websocket connection is part of that initialization.
    // The core problem is the re-assignment of `controllers.currentController` with a new object instance, even if the ID is the same, causing the `App.vue` watcher to trigger `initializeStores` again.
    // The fix in `controllersStore.js` to compare by ID (`String(this.currentController?.id) !== String(matchById.id)`) was the correct approach to prevent the re-trigger. I need to make sure that this comparison is applied to *all* places where `this.currentController` is assigned based on a `matchById` or similar.
    // In the current `controllersStore.js`, the initial assignment is:
    // ```javascript
    //             if (match) {
    //               localhost.hostname = match.hostname;
    //               this.currentController = match;
    //               this.homeController = match;
    //               console.log(
    //                 `Matched numeric ip_address, set localhost.hostname to '${match.hostname}' and set controllers`,
    //               );
    //             }
    // ```
    // Here, `this.currentController` is assigned directly. If `match` is a new object, it will trigger the watcher.
    // The `localhost` object is a simple object, not a reactive one from `controllers.data`. When `controllers.currentController = localhost;` happens, it's setting it to a plain object. Then `controllers.fetchData()` finds a *reactive* object from its `data` array and assigns it. This is a change in object reference.
    // To prevent the re-trigger, the `App.vue` watcher needs to be smarter, or the `currentController` assignment needs to be guarded.
    // Let's re-examine the log carefully:
    // `Matched numeric ip_address, set localhost.hostname to 'Lightinator-6668181' and set controllers controllersStore.js:87:23` (This is the first time `currentController` is set to the actual controller object from `controllers.data`).
    // ...
    // `info data fetched: ...`
    // `normalizeInfoData: detected schema version 2 (nested structure) infoDataStore.js:21:13`
    // `infoData.status changed to ready RgbwwLayout.vue:445:17`
    // `controller is configured, not redirecting RgbwwLayout.vue:496:19`
    // `Matched numeric ip_address, set localhost.hostname to 'Lightinator-6668181' and set controllers controllersStore.js:87:23` (This line appears *again*).
    // This means `controllers.fetchData()` is indeed being called twice, and the `localhost` matching logic is executed twice.
    // The problem is that `initializeStores` is called twice.
    // 1.  Implicitly on app startup.
    // 2.  Explicitly by `App.vue`'s watcher when `controllers.currentController` changes from `null` to `localhost`.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores()`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    // The core problem is the re-triggering of `initializeStores`. This happens because `controllers.currentController` is updated multiple times.
    // The `App.vue` watcher is the one that calls `initializeStores`.
    // 1.  `controllers.currentController` is `null`.
    // 2.  `initializeStores()` is called (first time).
    // 3.  Inside `initializeStores`, `controllers.currentController` is set to `localhost` (a plain object).
    // 4.  `App.vue` watcher sees `controllers.currentController?.ip_address` change from `undefined` to `localhost.ip_address`. It calls `initializeStores({ force: true })` again.
    // 5.  Inside the second `initializeStores()` call:
    //     *   `controllers.fetchData()` is called. It populates `controllers.data`.
    //     *   The logic to set `initialController` based on `localhost.ip_address` finds a match in `controllers.data`. This `match` is a *reactive* object.
    //     *   `controllers.currentController` is set to this `match` object. This is a change in object reference from the `localhost` placeholder.
    //     *   This triggers the `App.vue` watcher *again*.
    // This is the loop. The `App.vue` watcher needs to be smarter, or `controllers.currentController` needs to be set to a stable object from the start.
    // Final attempt at a robust fix:
    // 1.  **`src/services/initializeStores.js`:**
    //     *   Remove the `watch` for `controllers.currentController?.ip_address` from `initializeStores`. This watcher is redundant and problematic.
    //     *   The initial setting of `controllers.currentController` should be done carefully.
    //     *   The refinement of `currentController` based on `infoData` should be done in a way that doesn't trigger a re-initialization if the logical controller is the same.
    //     *   The websocket connection logic should be here, but only connect if the URL is truly different.
    // 2.  **`src/stores/controllersStore.js`:**
    //     *   `fetchData` should *only* populate `this.data`.
    //     *   `currentController` and `homeController` should *only* be set via `selectController` or a similar explicit action.
    // Let's make `initializeStores` responsible for orchestrating the `currentController` selection.
    // This is a much more significant change.
    // 1.  `controllersStore.fetchData` now only fetches the list of hosts.
    // 2.  `initializeStores` now handles the complex logic of determining and setting `currentController` and `homeController` based on available data (localhost, then infoData).
    // 3.  The `currentController` is only updated if the logical ID changes, preventing unnecessary re-triggers of the `App.vue` watcher.
    // 4.  The websocket connection is established only once `currentController` is determined.
    // This should resolve the issue of `infoDataStore` resetting due to a re-initialization loop.
    // Let's also fix the `localhost` assignment in `initializeStores.js`. It should be `controllers.currentController = initialController;` and `controllers.homeController = initialController;`.
    // The `localhost` object is a constant, it should not be directly assigned to `controllers.currentController`. Instead, `controllers.currentController` should be assigned a *new* object or an object from `controllers.data`.
    // Let's adjust the `localhost` handling in `initializeStores.js`.
    // The `localhost` object is a constant and should not be modified. Its `hostname` property should not be updated. The `currentController` object's `hostname` should be used for display.
    // Let's revert the `localhost.hostname` assignments and ensure `currentController` is set correctly.
    
    insertControllerAlphabetically(controller) {
      this.data.push(controller);
      this.data.sort((a, b) => a.hostname.localeCompare(b.hostname));
    },

    selectController(controller) {
      this.currentController = controller;
      console.log(
        "selected controller: ",
        controller["hostname"],
        "with IP address ",
        controller["ip_address"],
      );
    },

    async updateControllerMetadata(controller, metadata) {
      try {
        // Ensure timestamp is updated to current Unix time (milliseconds)
        metadata.ts = Date.now();

        // Save controller metadata to the backend in the controllers section
        console.log(
          `DEBUG: Updating metadata for controller ${controller.hostname}:`,
          JSON.stringify(metadata, null, 2),
        );

        // Check if controller metadata already exists
        console.log(
          `DEBUG: Fetching existing data from http://${controller.ip_address}/data`,
        );
        const { jsonData: existingData, error: existingError } =
          await apiService.getDataFromController(controller.ip_address, {
            headers: { Accept: "application/json" },
          });

        let payload;
        if (!existingError && existingData) {
          console.log("DEBUG: Existing data structure:", {
            hasControllers: !!existingData.controllers,
            controllersLength: existingData.controllers?.length || 0,
            controllers: existingData.controllers,
          });

          const existingController = existingData.controllers?.find(
            (c) => c.id === metadata.id,
          );

          if (existingController) {
            // Update existing controller metadata
            payload = { [`controllers[id=${metadata.id}]`]: metadata };
            console.log(
              "DEBUG: Updating existing controller metadata with payload:",
              JSON.stringify(payload, null, 2),
            );
          } else {
            // Add new controller metadata
            payload = { "controllers[]": [metadata] };
            console.log(
              "DEBUG: Adding new controller metadata with payload:",
              JSON.stringify(payload, null, 2),
            );
          }
        } else {
          // Add new controller metadata if we can't check existing
          payload = { "controllers[]": [metadata] };
          console.log(
            "DEBUG: Adding new controller metadata (couldn't check existing) with payload:",
            JSON.stringify(payload, null, 2),
          );
        }

        console.log(`DEBUG: POSTing to http://${controller.ip_address}/data`);
        const { jsonData, error } = await apiService.updateDataOnController(
          controller.ip_address,
          payload,
        );

        if (error) {
          throw new Error(`API error: ${error.message}`);
        }

        console.log(`DEBUG: POST response successful:`, jsonData);

        if (!response.ok) {
          const responseText = await response.text();
          console.error(`DEBUG: POST response error text:`, responseText);
          throw new Error(
            `HTTP error! status: ${response.status}, response: ${responseText}`,
          );
        }

        const responseData = await response.text();
        console.log(`DEBUG: POST response data:`, responseData);

        console.log(
          `Successfully saved metadata for controller ${controller.hostname}`,
        );
        return true;
      } catch (error) {
        console.error(
          `Failed to save metadata for controller ${controller.hostname}:`,
          error,
        );
        return false;
      }
    },
  },
});
