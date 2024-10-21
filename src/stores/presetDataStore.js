import { defineStore } from "pinia";
import {
  localhost,
  storeStatus,
  maxRetries,
  retryDelay,
} from "./storeConstants";
import { safeStringify } from "./storeHelpers";
import { controllersStore } from "./controllersStore";
import useWebSocket from "src/services/websocket.js";

export const presetDataStore = defineStore({
  id: "presetDataStore",

  state: () => ({
    data: {
      presets: [],
    },
    status: storeStatus.LOADING,
  }),

  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      fetchApi("info").then(({ jsonData, error }) => {
        if (error) {
          console.error("error fetching info data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("info data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
          this.status = storeStatus.READY;
        }
      });
    },
    async addPreset(preset) {
      const controllers = controllersStore();
      let payload = { "presets[]": [preset] };
      console.log("addPreset payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/presets`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data["presets"].push(preset);
        console.log("added preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("error adding preset:", error);
      }
    },
    async updatePreset(preset) {},
    async deletePreset(preset) {},
  },
});
