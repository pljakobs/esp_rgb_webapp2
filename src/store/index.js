import { defineStore } from "pinia";
import useWebSocket, { wsStatus } from "../services/websocket";

/**
 * Retrieves the IP address based on the current environment.
 * If the environment is set to "development", it returns the hardcoded IP address of a well known controller.
 * Otherwise, it returns the hostname of the current window.
 *
 * @returns {string} The IP address.
 */
export const localhost = {
  hostname: "localhost",
  ip_address:
    process.env.NODE_ENV === "development"
      ? "192.168.29.49"
      : window.location.hostname,
};
export const storeStatus = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

const maxRetries = 5; // Maximum number of retries
const retryDelay = 1000; // Delay for the first retry in milliseconds

export const controllersStore = defineStore({
  id: "controllersStore",

  state: () => ({
    status: storeStatus.LOADING,
    currentController: localhost,

    data: [localhost],
  }),
  actions: {
    async fetchData(retryCount = 0) {
      try {
        console.log("controllers start fetching data");
        const response = await fetch(`http://${localhost["ip_address"]}/hosts`);
        const jsonData = await response.json();
        this.data = jsonData["hosts"];
        console.log("controllers data fetched: ", jsonData["hosts"]);
        this.data = jsonData["hosts"]
          .filter((host) => host.ip_address)
          .map((host) => {
            return {
              ...host,
              ip_address: host.ip_address.trim(),
            };
          }); //removing leading and trailing whitespaces from the ip address
        this.status = storeStatus.READY;
        console.log("hosts data fetched: ", JSON.stringify(this.data));
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching preset data:", error);
      }
    },
    selectController(controller) {
      this.currentController = controller;
      console.log(
        "selected controller: ",
        currentController["hostname"],
        "with ip address ",
        currentController["ip_address"],
      );
    },
  },
});

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
          `http://${controllers.currentController["ip_address"]}/object?type=p`,
        );
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/object?type=p`,
        );
        const presetsArray = await response.json();
        console.log("presetsArray: ", presetsArray);
        for (const id of presetsArray["presets"]) {
          console.log("fetching preset with id: ", id);
          const response = await fetch(
            `http://${controllers.currentController["ip_address"]}/object?type=p&id=${id}`,
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
          (p) => p.id === params.id,
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
          },
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
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const presetToUpdate = this.data["presets"].find(
          (p) => p.id === preset.id,
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
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data["presets"] = this.data["presets"].filter(
          (p) => p.id !== preset.id,
        );
        console.log("deleted preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    },
  },
});

/**
 * Groups Store
 *
 * one goal for this release is for the app to have a notion of controller groups that can be used to control multiple lights at once
 *
 * for now, this is implemented as a simple stored file on the controller that can be accessed by <controllers.currentController["ip_address"]>/groups.json and
 * written to using the /storage api call that expects a json object with filename: at the top level, followed by data: and the object
 * to write to flash
 */
export const groupsDataStore = defineStore({
  id: "groupsDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      try {
        console.log(
          "preset start fetching data from controller:",
          controllers.currentController["ip_address"],
        );
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/groups.json`,
        );
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("groups data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching groups data:", error);
      }
    },
  },
});

export const infoDataStore = defineStore({
  id: "infoDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      try {
        console.log("info start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/info`, // correct string interpolation
        );

        if (response.status === 429 && retryCount < maxRetries) {
          // Too many requests, retry after a delay
          console.log(
            `Request limit reached, retrying after ${
              retryDelay * 2 ** retryCount
            }ms...`,
          );
          setTimeout(
            () => this.fetchData(retryCount + 1),
            retryDelay * 2 ** retryCount,
          );
          return;
        }

        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log(
          "infoData status: ",
          this.status,
          "\ninfoData fetched: ",
          this.data,
        );
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching info data:", error);
      }
    },
  },
});

export const colorDataStore = defineStore({
  id: "colorDataStore",
  state: () => ({
    data: {
      raw: { r: 0, g: 0, b: 0, cw: 0, ww: 0 },
      hsv: { h: 0, s: 0, v: 0, ct: 0 },
    },
    status: storeStatus.LOADING,
    change_by: "load",
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();
      const ws = useWebSocket();

      try {
        console.log("color start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/color`,
        );
        if (response.status === 429 && retryCount < maxRetries) {
          // Too many requests, retry after a delay
          console.log(
            `Request limit reached, retrying after ${
              retryDelay * 2 ** retryCount
            }ms...`,
          );
          setTimeout(
            () => this.fetchData(retryCount + 1),
            retryDelay * 2 ** retryCount,
          );
          return;
        }
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("color data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching color data:", error);
      }
      //
      // Subscribe to color events
      //
      ws.onJson("color_event", (params) => {
        const colorData = colorDataStore();
        colorData.change_by = "websocket";
        console.log("params mode: ", params.mode);
        if (params.mode === "hsv") {
          console.log("updating hsv color data", params.hsv);
          console.log("colorDataStore.data.hsv: ", JSON.stringify(colorData));
          console.log("params.hsv: ", params.hsv);
          colorData.data.hsv = params.hsv;
        } else if (params.mode === "raw") {
          console.log("updating raw color data", params.raw);
          colorData.data.raw = params.raw;
        }

        console.log(
          "color store updated by websocket message to ",
          JSON.stringify(colorData),
        );
        colorData.change_by = null;
      });
    },
    updateData(field, value) {
      console.log("updatData called, change by: ", this.change_by);
      if (this.change_by != "websocket" && this.change_by != "load") {
        const controllers = controllersStore();

        console.log("color update for field: ", field, "value: ", value);
        if (field === "hsv") {
          this.data.hsv = value;
        } else if (field === "raw") {
          const [[key, val]] = Object.entries(value);
          this.data.raw[key] = val;
        }

        const path = field.split(".");
        let current = this;

        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }

        current[path[path.length - 1]] = value;
        let payload = {};
        payload[field] = value;
        console.log("color update payload: ", JSON.stringify(payload));
        console.log(
          "sending update to controller: ",
          controllers.currentController["ip_address"],
        );
        fetch(`http://${controllers.currentController["ip_address"]}/color`, {
          // Use controllers.currentController here
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {})
          .catch((error) => {
            console.error(
              "There was a problem with the fetch operation:",
              error,
            );
          });
      }
    },
  },
});

export const configDataStore = defineStore({
  id: "configDataStore",
  state: () => ({
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      try {
        console.log("config start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/config`,
        );
        if (response.status === 429 && retryCount < maxRetries) {
          // Too many requests, retry after a delay
          console.log(
            `Request limit reached, retrying after ${
              retryDelay * 2 ** retryCount
            }ms...`,
          );
          setTimeout(
            () => this.fetchData(retryCount + 1),
            retryDelay * 2 ** retryCount,
          );
          return;
        }
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("config data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching config data:", error);
      }
    },
    updateData(field, value) {
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value,
      );
      // Make a PUT request to the API endpoint
      fetch(`http://${controllers.currentController["ip_address"]}/config`, {
        // Use controllers.currentController here
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.data),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {})
        .catch((error) => {
          console.error("There was a problem with the fetch operation:", error);
        });
    },
  },
});
