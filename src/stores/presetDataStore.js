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
      const ws = useWebSocket();
      try {
        console.log("preset start fetching data");
        console.log(
          `http://${controllers.currentController["ip_address"]}/object?type=p`
        );
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/object?type=p`
        );
        const presetsArray = await response.json();
        console.log("presetsArray: ", presetsArray);
        for (const id of presetsArray["presets"]) {
          console.log("fetching preset with id: ", id);
          const response = await fetch(
            `http://${controllers.currentController["ip_address"]}/object?type=p&id=${id}`
          );
          const preset = await response.json();
          console.log("preset fetched: ", preset);
          console.log("preset data: ", this.data);
          if (
            !preset.deleted &&
            !this.data["presets"].some((p) => p.id === preset.id)
          ) {
            this.data["presets"].push(preset);
          } else {
            console.log("preset already exists in store or is deleted");
          }
        }
        this.status = storeStatus.READY;
        console.log("preset data fetched: ", JSON.stringify(this.data));
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching preset data:", error);
      }
      ws.onJson("preset", (params) => {
        this.change_by = "websocket";
        console.log("updating preset by websocket, params: ", params);

        const existingPresetIndex = this.data.presets.findIndex(
          (p) => p.id === params.id
        );
        console.log("this.data.presets: ", this.data.presets);
        if (existingPresetIndex !== -1) {
          // Overwrite existing preset
          this.data.presets[existingPresetIndex] = params;
          console.log("Preset overwritten: ", params);
        } else {
          // Create new preset
          this.data.presets.push(params);
          console.log("New preset created: ", params);
        }

        this.change_by = null;
      });
    },
    async addPreset(preset) {
      const controllers = controllersStore();
      let payload = preset;
      console.log("addPreset payload: ", JSON.stringify(payload));
      try {
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/object?type=p`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        console.log("response: ", JSON.stringify(responseData));
        console.log("Preset added successfully");
        preset.id = responseData.id;
        this.data["presets"].push(preset);
        console.log("added preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("Error adding preset:", error);
      }
    },
    async updatePreset(preset) {
      const controllers = controllersStore();
      let payload = preset;
      console.log("updatePreset payload: ", JSON.stringify(payload));
      try {
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/object?type=p&id=${preset.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const presetToUpdate = this.data["presets"].find(
          (p) => p.id === preset.id
        );
        if (presetToUpdate) {
          Object.assign(presetToUpdate, preset);
        }
        console.log("updated preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("Error updating preset:", error);
      }
    },
    async deletePreset(preset) {
      const controllers = controllersStore();
      let payload = { id: preset.id, type: "p", deleted: "true" };
      try {
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/object?type=p&id=${preset.id}`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data["presets"] = this.data["presets"].filter(
          (p) => p.id !== preset.id
        );
        console.log("deleted preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    },
  },
});
