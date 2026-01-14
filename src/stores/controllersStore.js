import { defineStore } from "pinia";
import { localhost, storeStatus } from "./storeConstants";
import useWebSocket from "src/services/websocket.js";
import { infoDataStore } from "src/stores/infoDataStore"; // Import infoDataStore
import { apiService } from "src/services/api.js";

export const useControllersStore = defineStore("controllersStore", {
  state: () => ({
    data: [],
    storeStatus: storeStatus.store.LOADING,
    currentController: null, // Will be set from /hosts response only
    homeController: null, // Will be set from /hosts response only
    http_response_status: null,
  }),

  getters: {
    // Legacy compatibility getter
    status: (state) => state.storeStatus,
  },

  actions: {
    async fetchData(retryCount = 0) {
      try {
        infoDataStore();
        console.log("controllers start fetching data");
        this.storeStatus = storeStatus.store.LOADING;

        const { jsonData, error } = await apiService.getHosts(true);
        if (error) {
          this.storeStatus = storeStatus.store.ERROR;
          this.error = error;
          console.error("Error fetching controllers data:", error);
          throw error;
        }
        if (jsonData && Array.isArray(jsonData.hosts)) {
          this.data = jsonData.hosts;
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
          infoStore.data.deviceid
        ) {
          const matchById = this.data.find(
            (c) => String(c.id) === String(infoStore.data.deviceid),
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
            payload = { [`controllers[id="${metadata.id}"]`]: metadata };
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
