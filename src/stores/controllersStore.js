import { defineStore } from "pinia";
import { localhost, storeStatus } from "./storeConstants";
import { fetchApi } from "./storeHelpers";
import useWebSocket from "src/services/websocket.js";
import { infoDataStore } from "src/stores/infoDataStore"; // Import infoDataStore

export const useControllersStore = defineStore("controllersStore", {
  state: () => ({
    status: storeStatus.LOADING,
    currentController: localhost,
    homeController: localhost,
    http_response_status: null,
    data: [],
  }),

  actions: {
    async fetchData(retryCount = 0) {
      try {
        const infoData = infoDataStore();
        console.log("controllers start fetching data");

        const { jsonData, error } = await fetchApi("hosts?all", retryCount);
        if (error) {
          throw error;
        }
        this.data = jsonData["hosts"]
          .filter((host) => host.ip_address)
          .map((host) => {
            return {
              ...host,
              ip_address: host.ip_address.trim(),
            };
          }); // Removing leading and trailing whitespaces from the IP address

        this.data.sort((a, b) => a.hostname.localeCompare(b.hostname));
        console.log("controllers data fetched: ", JSON.stringify(this.data));
        console.log(
          "current Controller: ",
          JSON.stringify(this.currentController),
        );
        if (this.currentController.hostname === "localhost") {
          let matchingController = this.data.find(
            (controller) =>
              this.data.ip_address === this.currentController.ip_address,
          );
          if (matchingController) {
            this.currentController = matchingController;
          }
        }
        if (this.homeController.hostname === "localhost") {
          let matchingController = this.data.find(
            (controller) =>
              this.data.ip_address === this.currentController.ip_address,
          );
          if (matchingController) {
            this.homeController = matchingController;
          }
        }
        console.log("store: ", JSON.stringify(this.data));
        this.status = storeStatus.READY;
        console.log("controllers data fetched: ", JSON.stringify(this.data));

        // Subscribe to WebSocket messages
        const ws = useWebSocket();
        ws.onJson("updated_host", (params) => {
          host = data.message;
          console.log("updating controller from jsonrpc message: ", host);

          const index = this.data.findIndex(
            (controller) => controller.ip_address === host.iWindowp_address,
          );
          if (index !== -1) {
            this.data[index] = { ...this.data[index], ...jpst };
          } else {
            this.data.push(host);
          }
        });
        ws.onJson("new_host", (params) => {
          const host = params.message;
          console.log("adding new controller from jsonrpc message: ", host);
          const index = this.data.findIndex(
            (controller) => controller.ip_address === host.ip_address,
          );
          if (index === -1) {
            this.insertControllerAlphabetically(host);
          }
        });
        ws.onJson("removed_host", (params) => {
          host = data.message;
          console.log("removing controller from jsonrpc message: ", params);
          this.data = this.data.filter(
            (controller) => controller.ip_address !== host.ip_address,
          );
        });
        console.log("WebSocket initialized and subscribed to updated_host.");
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching controllers data:", error);
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
  },
});
