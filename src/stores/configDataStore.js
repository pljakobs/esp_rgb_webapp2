import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { useControllersStore } from "src/stores/controllersStore";
import { safeStringify } from "src/stores/storeHelpers";
import { apiService } from "src/services/api.js";

function normalizeConfigPath(path) {
  if (typeof path !== "string") {
    return path;
  }

  if (path === "telemetry") {
    return "network.telemetry";
  }

  if (path.startsWith("telemetry.")) {
    return `network.${path}`;
  }

  return path;
}

export const configDataStore = defineStore("configDataStore", {
  state: () => ({
    status: storeStatus.LOADING,
    http_response_status: null,
    data: {
      color: {
        color_mode: 0,
        // other properties...
      },
      // other properties...
    },
  }),
  actions: {
    async fetchData() {
      this.status = storeStatus.LOADING;
      try {
        const { jsonData, error } = await apiService.getConfig();
        if (error) {
          throw error;
        }

        console.log("config data fetched: ", JSON.stringify(jsonData));
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("new configData(this): ", this);
        return jsonData;
      } catch (err) {
        this.status = storeStatus.ERROR;
        console.error("error fetching config data:", err);
        throw err;
      }
    },
    async updateData(field, value, update = true) {
      field = normalizeConfigPath(field);
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value,
      );
      console.log("updating config data: ", this.data);

      const fieldParts = field.split(".");
      let currentObject = this.data;
      for (let i = 0; i < fieldParts.length - 1; i++) {
        const key = fieldParts[i];
        if (currentObject[key] == null) {
          currentObject[key] = {};
        }
        currentObject = currentObject[key];
      }

      currentObject[fieldParts[fieldParts.length - 1]] = value;

      const minimalUpdate = {};
      let tempObject = minimalUpdate;
      currentObject = this.data;

      for (let i = 0; i < fieldParts.length - 1; i++) {
        const key = fieldParts[i];
        tempObject[key] = Array.isArray(currentObject?.[key]) ? [] : {};
        tempObject = tempObject[key];
        currentObject = currentObject?.[key];
      }

      tempObject[fieldParts[fieldParts.length - 1]] = value;

      console.log("minimalUpdate: ", safeStringify(minimalUpdate));
      if (update) {
        await this.updateApi(minimalUpdate);
      }
    },
    async updateMultipleData(updates, update = true) {
      const normalizedUpdates = {};
      Object.entries(updates).forEach(([field, value]) => {
        normalizedUpdates[normalizeConfigPath(field)] = value;
      });

      console.log(
        "updateMultipleData called with:",
        Object.keys(normalizedUpdates).length,
        "updates",
      );

      // Apply all updates to local state
      Object.entries(normalizedUpdates).forEach(([field, value]) => {
        const fieldParts = field.split(".");
        let currentObject = this.data;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          const key = fieldParts[i];
          if (currentObject[key] == null) {
            currentObject[key] = {};
          }
          currentObject = currentObject[key];
        }
        currentObject[fieldParts[fieldParts.length - 1]] = value;
      });

      if (update) {
        // Send all updates as a single API call
        const minimalUpdate = {};

        Object.entries(normalizedUpdates).forEach(([field, value]) => {
          const fieldParts = field.split(".");
          let tempObject = minimalUpdate;
          let currentObject = this.data;

          for (let i = 0; i < fieldParts.length - 1; i++) {
            const key = fieldParts[i];
            if (!tempObject[key]) {
              tempObject[key] = Array.isArray(currentObject?.[key]) ? [] : {};
            }
            tempObject = tempObject[key];
            currentObject = currentObject?.[key];
          }
          tempObject[fieldParts[fieldParts.length - 1]] = value;
        });

        console.log(
          "minimalUpdate for multiple data:",
          safeStringify(minimalUpdate),
        );
        await this.updateApi(minimalUpdate);
      }
    },
    async updateApi(minimalUpdate) {
      console.log("updateApi called with: ", safeStringify(minimalUpdate));
      try {
        const { jsonData, error } = await apiService.postConfig(minimalUpdate);
        if (error) {
          throw error;
        }
        console.log("config updated successfully:", jsonData);
        return jsonData;
      } catch (error) {
        console.error("There was a problem with the config update:", error);
        throw error;
      }
    },
  },
});
